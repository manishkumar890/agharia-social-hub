import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { profileApi, uploadApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';
import DeleteAccountDialog from '@/components/DeleteAccountDialog';
import AvatarCropDialog from '@/components/AvatarCropDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const Settings = () => {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [dob, setDob] = useState(profile?.dob || '');
  const [isLoading, setIsLoading] = useState(false);

  // Avatar upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      const objectUrl = URL.createObjectURL(file);
      setCropImageSrc(objectUrl);
      setCropDialogOpen(true);
    }
    e.target.value = '';
  };

  const handleCropComplete = (croppedFile: File) => {
    setNewAvatarFile(croppedFile);
    setAvatarPreview(URL.createObjectURL(croppedFile));
    setCropDialogOpen(false);
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
    }
  };

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

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      let finalAvatarUrl = avatarUrl;

      // Upload new avatar if selected
      if (newAvatarFile) {
        try {
          const result = await uploadApi.uploadFile('avatars', newAvatarFile);
          finalAvatarUrl = result.url;
        } catch (uploadError) {
          console.error('Avatar upload error:', uploadError);
          toast.error('Failed to upload avatar');
          setIsLoading(false);
          return;
        }
      }

      // Update profile
      await profileApi.updateProfile({
        full_name: fullName.trim(),
        bio: bio.trim() || undefined,
        email: email.trim().toLowerCase() || undefined,
        dob: dob || undefined,
        avatar_url: finalAvatarUrl || undefined,
      });

      setNewAvatarFile(null);
      setAvatarPreview(null);
      await refreshProfile();
      toast.success('Profile updated successfully!');
    } catch (error: any) {
      console.error('Update error:', error);
      if (error.message?.includes('already')) {
        toast.error('Username or email already taken');
      } else {
        toast.error(error.message || 'Failed to update profile');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const displayAvatar = avatarPreview || (avatarUrl ? uploadApi.getFileUrl(avatarUrl) : '');

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-14 pb-20 md:pb-16">
        <div className="max-w-xl lg:max-w-2xl mx-auto px-4 py-6">
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
              {/* Avatar Upload */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative cursor-pointer" onClick={handleAvatarClick}>
                  <Avatar className="w-24 h-24 border-4 border-primary/30">
                    <AvatarImage src={displayAvatar || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-display">
                      {fullName.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-0 right-0 p-1.5 bg-primary rounded-full shadow-md">
                    <Camera className="w-4 h-4 text-primary-foreground" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Tap to change photo</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarFileChange}
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

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                />
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

              {/* Separator and Delete Account */}
              <Separator className="my-4" />
              
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">
                  Danger Zone
                </p>
                <DeleteAccountDialog />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <MobileNav />

      {/* Avatar Crop Dialog */}
      {cropImageSrc && (
        <AvatarCropDialog
          open={cropDialogOpen}
          onClose={() => {
            setCropDialogOpen(false);
            if (cropImageSrc) {
              URL.revokeObjectURL(cropImageSrc);
              setCropImageSrc(null);
            }
          }}
          imageSrc={cropImageSrc}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
};

export default Settings;
