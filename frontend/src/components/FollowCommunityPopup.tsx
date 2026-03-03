import { useState, useEffect } from 'react';
import { followApi, profileApi, uploadApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const COMMUNITY_USER_ID = 'b77ca098-1846-4cd2-961c-7776230485d1';
const COMMUNITY_USERNAME = 'aghariasamaj';

const FollowCommunityPopup = () => {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [communityProfile, setCommunityProfile] = useState<{ avatar_url: string | null; full_name: string | null } | null>(null);

  useEffect(() => {
    if (!user || !profile) return;
    // Don't show for the community account itself
    if (profile.user_id === COMMUNITY_USER_ID) {
      setLoading(false);
      return;
    }
    checkFollowStatus();
  }, [user, profile]);

  const checkFollowStatus = async () => {
    if (!user || !profile) return;
    try {
      // Get community profile
      const communityData = await profileApi.getProfile(COMMUNITY_USER_ID);
      if (communityData) {
        setCommunityProfile({
          avatar_url: communityData.avatar_url ? uploadApi.getFileUrl(communityData.avatar_url) : null,
          full_name: communityData.full_name
        });
      }

      // Check if user follows community
      const following = await followApi.getFollowing(profile.user_id);
      const isFollowing = following.some((f: any) => f.user_id === COMMUNITY_USER_ID);

      if (!isFollowing) {
        setOpen(true);
      }
    } catch (error) {
      console.error('Error checking community follow:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!user || !profile) return;
    setFollowLoading(true);
    try {
      await followApi.toggleFollow(COMMUNITY_USER_ID);
      toast.success('Welcome to Agharia Samaj Community! 🎉');
      setOpen(false);
    } catch (error) {
      console.error('Follow error:', error);
      toast.error('Failed to follow. Please try again.');
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading || !open) return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-[340px] w-[90%] p-0 overflow-hidden border-none rounded-2xl [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="bg-gradient-to-br from-primary/10 via-background to-accent/10 p-6">
          <DialogHeader className="items-center text-center space-y-3">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-primary to-accent p-0.5">
              <Avatar className="w-full h-full border-2 border-background">
                <AvatarImage src={communityProfile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-display">
                  A
                </AvatarFallback>
              </Avatar>
            </div>
            <DialogTitle className="text-xl font-display">
              Agharia Samaj
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Follow <span className="font-semibold text-foreground">@{COMMUNITY_USERNAME}</span> to stay updated with the latest posts, events, and community news.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
              <Users className="w-5 h-5 text-primary flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                Following the community is required to use the app and see all posts.
              </p>
            </div>

            <Button
              onClick={handleFollow}
              disabled={followLoading}
              className="w-full gradient-maroon text-primary-foreground font-semibold py-5"
            >
              {followLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Users className="w-5 h-5 mr-2" />
                  Follow @{COMMUNITY_USERNAME}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FollowCommunityPopup;
