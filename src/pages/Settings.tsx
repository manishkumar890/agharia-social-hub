import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const Settings = () => {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [dob, setDob] = useState((profile as any)?.dob || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!profile) return;

    if (!fullName.trim()) {
      toast.error('Full name is required');
      return;
    }

    if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
      toast.error('Username can only contain letters, numbers, and underscores');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          username: username.trim() || null,
          bio: bio.trim() || null,
          avatar_url: avatarUrl.trim() || null,
          dob: dob || null,
        })
        .eq('id', profile.id);

      if (error) {
        if (error.code === '23505') {
          toast.error('Username already taken');
          return;
        }
        throw error;
      }

      await refreshProfile();
      toast.success('Profile updated successfully!');
    } catch (error: any) {
      console.error('Update error:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-[calc(4rem+3.5rem)] pb-20 md:pb-8">
        <div className="max-w-lg mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-display font-semibold">Edit Profile</h1>
          </div>

          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="text-lg">Profile Information</CardTitle>
              <CardDescription>Update your profile details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <Avatar className="w-24 h-24 border-4 border-primary/30">
                    <AvatarImage src={avatarUrl || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-display">
                      {fullName.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-0 right-0 p-1 bg-primary rounded-full">
                    <Camera className="w-4 h-4 text-primary-foreground" />
                  </div>
                </div>
                <Input
                  placeholder="Avatar URL"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="text-center text-sm"
                />
              </div>

              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>

              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="Choose a username"
                />
                <p className="text-xs text-muted-foreground">
                  Only letters, numbers, and underscores
                </p>
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself"
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Date of Birth */}
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
                <p className="text-xs text-muted-foreground">
                  This will be shown on your VIP card
                </p>
              </div>

              {/* Phone (read-only) */}
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  value={`+91 ${profile?.phone || ''}`}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Phone number cannot be changed
                </p>
              </div>

              {/* Save Button */}
              <Button
                className="w-full gradient-maroon text-primary-foreground"
                onClick={handleSave}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <MobileNav />
    </div>
  );
};

export default Settings;
