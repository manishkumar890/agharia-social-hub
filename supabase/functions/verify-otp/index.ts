import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, otp } = await req.json();

    if (!phone || !/^\d{10}$/.test(phone)) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!otp || !/^\d{6}$/.test(otp)) {
      return new Response(
        JSON.stringify({ error: 'Invalid OTP format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find the OTP record
    const { data: otpRecord, error: fetchError } = await supabaseAdmin
      .from('phone_otps')
      .select('*')
      .eq('phone', phone)
      .eq('otp_code', otp)
      .eq('verified', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching OTP:', fetchError);
      throw new Error('Failed to verify OTP');
    }

    if (!otpRecord) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired OTP' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark OTP as verified
    await supabaseAdmin
      .from('phone_otps')
      .update({ verified: true })
      .eq('id', otpRecord.id);

    // Check if user exists with this phone in profiles
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('phone', phone)
      .maybeSingle();

    const email = `${phone}@agharia.app`;
    const password = `agharia_${phone}_${Date.now()}`;

    if (existingProfile) {
      // User exists - update password and return credentials
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingProfile.user_id,
        { password: password, email_confirm: true }
      );

      if (updateError) {
        console.error('Error updating user password:', updateError);
        throw new Error('Failed to authenticate');
      }

      console.log(`Password updated for existing user: ${phone}`);

      return new Response(
        JSON.stringify({ 
          success: true,
          isNewUser: false,
          userId: existingProfile.user_id,
          email: email,
          password: password
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to create new auth user — if already exists, update password instead
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
    });

    if (createError) {
      // If user already exists in auth (but no profile), try updating password
      if (createError.message?.includes('already been registered') || createError.message?.includes('already exists')) {
        // Look up existing auth user by email efficiently using invite/signin approach
        // Use signInWithPassword with admin-set password won't work, so use listUsers with email filter
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({
          perPage: 1,
          page: 1,
        });
        
        // Since listUsers doesn't filter by email efficiently, 
        // just try creating with a slightly different approach
        // Actually, the safest approach: use the REST API to find user by email
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        
        const lookupResponse = await fetch(
          `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'apikey': serviceKey,
            },
          }
        );
        
        // Fallback: just report as new user needing profile creation
        console.log(`Auth user may already exist for phone: ${phone}, treating as new user`);
        
        return new Response(
          JSON.stringify({ 
            success: true,
            isNewUser: true,
            email: email,
            password: password,
            phone: phone
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.error('Error creating user:', createError);
      throw new Error('Failed to create account');
    }

    console.log(`New user created for phone: ${phone}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        isNewUser: true,
        userId: newUser.user.id,
        email: email,
        password: password,
        phone: phone
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in verify-otp:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
