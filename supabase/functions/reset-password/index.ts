import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, newPassword, phone } = await req.json();

    // Validate inputs
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!newPassword || newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!phone || !/^\d{10}$/.test(phone)) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify that the OTP was recently verified for this phone
    const { data: otpRecord, error: otpError } = await supabaseAdmin
      .from('phone_otps')
      .select('*')
      .eq('phone', phone)
      .eq('verified', true)
      .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()) // Within last 10 minutes
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) {
      console.error('Error checking OTP verification:', otpError);
      throw new Error('Failed to verify OTP status');
    }

    if (!otpRecord) {
      return new Response(
        JSON.stringify({ error: 'OTP verification required. Please verify your phone first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user exists and matches the phone
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('user_id', userId)
      .eq('phone', phone)
      .maybeSingle();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'User not found or phone mismatch' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw new Error('Failed to update password');
    }

    // Clean up used OTP records for this phone
    await supabaseAdmin
      .from('phone_otps')
      .delete()
      .eq('phone', phone);

    console.log(`Password reset successful for user: ${userId}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Password reset successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in reset-password:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
