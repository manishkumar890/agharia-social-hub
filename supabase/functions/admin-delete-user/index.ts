import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify caller is admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin deleting user:', userId);

    // Delete all user data (same cascade as delete-account)
    // 1. Comments by user
    await supabaseAdmin.from('comments').delete().eq('user_id', userId);
    // 2. Likes by user
    await supabaseAdmin.from('likes').delete().eq('user_id', userId);
    // 3. Followers
    await supabaseAdmin.from('followers').delete().eq('follower_id', userId);
    await supabaseAdmin.from('followers').delete().eq('following_id', userId);
    // 4. Saved posts
    await supabaseAdmin.from('saved_posts').delete().eq('user_id', userId);
    // 5. Story data
    await supabaseAdmin.from('story_likes').delete().eq('user_id', userId);
    await supabaseAdmin.from('story_comments').delete().eq('user_id', userId);
    await supabaseAdmin.from('story_views').delete().eq('viewer_id', userId);

    // 6. Delete stories by user
    const { data: userStories } = await supabaseAdmin.from('stories').select('id').eq('user_id', userId);
    if (userStories && userStories.length > 0) {
      const storyIds = userStories.map(s => s.id);
      await supabaseAdmin.from('story_views').delete().in('story_id', storyIds);
      await supabaseAdmin.from('story_likes').delete().in('story_id', storyIds);
      await supabaseAdmin.from('story_comments').delete().in('story_id', storyIds);
    }
    await supabaseAdmin.from('stories').delete().eq('user_id', userId);

    // 7. Comments/likes on user's posts
    const { data: userPosts } = await supabaseAdmin.from('posts').select('id').eq('user_id', userId);
    if (userPosts && userPosts.length > 0) {
      const postIds = userPosts.map(p => p.id);
      await supabaseAdmin.from('comments').delete().in('post_id', postIds);
      await supabaseAdmin.from('likes').delete().in('post_id', postIds);
      await supabaseAdmin.from('saved_posts').delete().in('post_id', postIds);
    }

    // 8. Posts
    await supabaseAdmin.from('posts').delete().eq('user_id', userId);
    // 9. Messages & conversations
    const { data: convos } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);
    if (convos && convos.length > 0) {
      const convoIds = convos.map(c => c.id);
      await supabaseAdmin.from('messages').delete().in('conversation_id', convoIds);
      await supabaseAdmin.from('call_logs').delete().in('conversation_id', convoIds);
      await supabaseAdmin.from('conversations').delete().in('id', convoIds);
    }
    // 10. Subscriptions, device tokens, roles, contact queries
    await supabaseAdmin.from('user_subscriptions').delete().eq('user_id', userId);
    await supabaseAdmin.from('device_tokens').delete().eq('user_id', userId);
    await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
    await supabaseAdmin.from('contact_queries').delete().eq('user_id', userId);

    // 11. Avatar from storage
    const { data: profile } = await supabaseAdmin.from('profiles').select('avatar_url').eq('user_id', userId).single();
    if (profile?.avatar_url) {
      const urlParts = profile.avatar_url.split('/avatars/');
      if (urlParts.length > 1) {
        await supabaseAdmin.storage.from('avatars').remove([urlParts[1]]);
      }
    }

    // 12. Profile
    await supabaseAdmin.from('profiles').delete().eq('user_id', userId);
    // 13. Auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('Error deleting auth user:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete user account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User deleted successfully:', userId);
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
