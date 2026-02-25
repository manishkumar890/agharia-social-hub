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
    const { phone, otp, userId } = await req.json();
    console.log('Delete account request for phone:', phone, 'userId:', userId);

    // Validate inputs
    if (!phone || !/^\d{10}$/.test(phone)) {
      return new Response(
        JSON.stringify({ error: 'Valid 10-digit phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!otp || !/^\d{6}$/.test(otp)) {
      return new Response(
        JSON.stringify({ error: 'Valid 6-digit OTP is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify OTP
    const { data: otpData, error: otpError } = await supabaseAdmin
      .from('phone_otps')
      .select('*')
      .eq('phone', phone)
      .eq('otp_code', otp)
      .eq('verified', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpData) {
      console.error('OTP verification failed:', otpError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired OTP' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark OTP as verified
    await supabaseAdmin
      .from('phone_otps')
      .update({ verified: true })
      .eq('id', otpData.id);

    console.log('OTP verified, proceeding with account deletion for user:', userId);

    // Delete all user data in order (respecting foreign key constraints)
    
    // 1. Delete user's comments
    const { error: commentsError } = await supabaseAdmin
      .from('comments')
      .delete()
      .eq('user_id', userId);
    if (commentsError) console.error('Error deleting comments:', commentsError);

    // 2. Delete user's likes
    const { error: likesError } = await supabaseAdmin
      .from('likes')
      .delete()
      .eq('user_id', userId);
    if (likesError) console.error('Error deleting likes:', likesError);

    // 3. Delete followers (where user is follower or being followed)
    const { error: followersError1 } = await supabaseAdmin
      .from('followers')
      .delete()
      .eq('follower_id', userId);
    if (followersError1) console.error('Error deleting followers:', followersError1);

    const { error: followersError2 } = await supabaseAdmin
      .from('followers')
      .delete()
      .eq('following_id', userId);
    if (followersError2) console.error('Error deleting following:', followersError2);

    // 4. Delete comments on user's posts and likes on user's posts
    const { data: userPosts } = await supabaseAdmin
      .from('posts')
      .select('id')
      .eq('user_id', userId);

    if (userPosts && userPosts.length > 0) {
      const postIds = userPosts.map(p => p.id);
      
      await supabaseAdmin
        .from('comments')
        .delete()
        .in('post_id', postIds);
      
      await supabaseAdmin
        .from('likes')
        .delete()
        .in('post_id', postIds);
    }

    // 5. Delete user's posts
    const { error: postsError } = await supabaseAdmin
      .from('posts')
      .delete()
      .eq('user_id', userId);
    if (postsError) console.error('Error deleting posts:', postsError);

    // 6. Delete user roles
    const { error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId);
    if (rolesError) console.error('Error deleting user roles:', rolesError);

    // 7. Delete user's avatar from storage
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('avatar_url')
      .eq('user_id', userId)
      .single();

    if (profile?.avatar_url) {
      // Extract file path from URL
      const urlParts = profile.avatar_url.split('/avatars/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabaseAdmin.storage.from('avatars').remove([filePath]);
      }
    }

    // 8. Delete user profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('user_id', userId);
    if (profileError) console.error('Error deleting profile:', profileError);

    // 9. Finally, delete the auth user
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) {
      console.error('Error deleting auth user:', authError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete user account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Account deleted successfully for user:', userId);

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in delete-account function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
