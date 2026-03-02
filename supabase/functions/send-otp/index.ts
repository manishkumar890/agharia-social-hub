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
    const { phone } = await req.json();

    // Validate phone number (10 digits)
    if (!phone || !/^\d{10}$/.test(phone)) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number. Must be 10 digits.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // OTP expires in 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Create Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Delete any existing OTPs for this phone
    await supabaseAdmin
      .from('phone_otps')
      .delete()
      .eq('phone', phone);

    // Store new OTP in database
    const { error: insertError } = await supabaseAdmin
      .from('phone_otps')
      .insert({
        phone,
        otp_code: otp,
        expires_at: expiresAt,
        verified: false
      });

    if (insertError) {
      console.error('Error storing OTP:', insertError);
      throw new Error('Failed to generate OTP');
    }

    // Send OTP via 2Factor SMS API
    const smsApiKey = Deno.env.get('SMS_API_KEY');
    
    if (!smsApiKey) {
      console.error('SMS_API_KEY not configured');
      // Return OTP for demo if SMS not configured
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Real SMS service busy. Use it for complete registration.',
          otp: otp,
          expiresIn: 600
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2Factor API - Send our own OTP using the template
    // API Format: https://2factor.in/API/V1/{api_key}/SMS/{phone_number}/{otp}/{template_name}
    const smsUrl = `https://2factor.in/API/V1/${smsApiKey}/SMS/91${phone}/${otp}/OTP1`;
    
    const maskedPhone = `${'*'.repeat(6)}${phone.slice(-4)}`;
    console.log('Sending SMS OTP to:', maskedPhone);

    const smsAbortController = new AbortController();
    const smsTimeout = setTimeout(() => smsAbortController.abort(), 8000);

    let smsResult: any;
    try {
      const smsResponse = await fetch(smsUrl, {
        method: 'GET',
        signal: smsAbortController.signal,
      });

      smsResult = await smsResponse.json();
      console.log('2Factor SMS Response:', smsResult);
    } catch (smsError) {
      console.error('SMS provider timeout/error:', smsError);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Real SMS service busy. Use it for complete registration.',
          otp: otp,
          expiresIn: 600
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } finally {
      clearTimeout(smsTimeout);
    }

    if (smsResult.Status !== 'Success') {
      console.error('SMS sending failed:', smsResult);
      
      // If SMS fails, still return success but with OTP for demo
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Real SMS service busy. Use it for complete registration.',
          otp: otp,
          expiresIn: 600
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`OTP sent successfully to +91${phone}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'OTP sent to your mobile number',
        expiresIn: 600 // 10 minutes in seconds
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in send-otp:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
