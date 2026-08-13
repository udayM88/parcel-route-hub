import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import PageSeo from "@/components/PageSeo";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  User,
  Globe,
  Bell,
  Palette,
  Link as LinkIcon,
  LogOut,
  Trash2,
  ExternalLink,
  Share2,
  Star,
  Check,
  Loader2,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import BottomNav from "@/components/BottomNav";
import PageBackground from "@/components/PageBackground";

const Settings = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  const [smsNotifications, setSmsNotifications] = useState(true);
  const [promoNotifications, setPromoNotifications] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const authRaw = localStorage.getItem('auth_session') || localStorage.getItem('prayog_auth');
    if (!authRaw) {
      navigate('/login');
      return;
    }

    const authData = JSON.parse(authRaw);
    const { data } = await supabase.functions.invoke('get-profile', {
      body: { user_id: authData.user_id }
    });

    if (data?.profile) {
      setProfile(data.profile);
      setNameValue(data.profile.full_name || "");
      setSmsNotifications(data.profile.sms_notifications ?? true);
      setPromoNotifications(data.profile.promo_notifications ?? true);
      if (data.profile.preferred_language) {
        setSelectedLanguage(data.profile.preferred_language);
        i18n.changeLanguage(data.profile.preferred_language);
      }
      if (data.profile.theme_preference) {
        setTheme(data.profile.theme_preference);
      }
    }
    setLoading(false);
  };

  const updateProfile = async (updates: Record<string, any>) => {
    setSaving(true);
    try {
      const authRaw = localStorage.getItem('auth_session') || localStorage.getItem('prayog_auth');
      if (!authRaw) return;

      const authData = JSON.parse(authRaw);
      await supabase.functions.invoke('update-profile', {
        body: { user_id: authData.user_id, ...updates }
      });

      toast({
        title: t('settings.saved'),
        description: "Your preferences have been updated.",
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: "Failed to update preferences.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLanguageChange = async (lang: string) => {
    setSelectedLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('preferred_language', lang);
    await updateProfile({ preferred_language: lang });
  };

  const handleThemeChange = async (newTheme: string) => {
    setTheme(newTheme);
    await updateProfile({ theme_preference: newTheme });
  };

  const handleSmsToggle = async (checked: boolean) => {
    setSmsNotifications(checked);
    await updateProfile({ sms_notifications: checked });
  };

  const handlePromoToggle = async (checked: boolean) => {
    setPromoNotifications(checked);
    await updateProfile({ promo_notifications: checked });
  };

  const handleNameSave = async () => {
    await updateProfile({ full_name: nameValue });
    setProfile({ ...profile, full_name: nameValue });
    setEditingName(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_session');
    localStorage.removeItem('prayog_auth');
    toast({
      title: t('settings.logout'),
      description: "You have been logged out.",
    });
    navigate('/login');
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: 'ViaSetu',
        text: 'Check out ViaSetu - The best way to send packages!',
        url: window.location.origin,
      });
    } else {
      navigator.clipboard.writeText(window.location.origin);
      toast({
        title: "Link copied!",
        description: "Share link has been copied to clipboard.",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <PageBackground variant="warehouse" opacity={0.8} />
        <Loader2 className="h-8 w-8 animate-spin text-primary relative z-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pb-4 relative">
      <PageSeo title="Settings — Profile & Preferences | ViaSetu" description="Manage your ViaSetu profile, notifications, language and theme preferences." path="/settings" noindex />
      <PageBackground variant="warehouse" opacity={0.8} />
      
      <div className="p-4 max-w-2xl mx-auto space-y-4 relative z-10">
        {/* Header */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="text-white hover:bg-white/10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-semibold text-white">{t('settings.title')}</h1>
              {saving && <Loader2 className="h-4 w-4 animate-spin text-white/70 ml-auto" />}
            </div>
          </CardContent>
        </Card>

        {/* Profile Section */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-white">
              <User className="h-4 w-4 text-primary" />
              {t('settings.profile')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white/70 text-sm">{t('settings.name')}</Label>
              {editingName ? (
                <div className="flex gap-2">
                  <Input
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    className="flex-1 bg-white/20 border-white/30 text-white"
                  />
                  <Button size="sm" onClick={handleNameSave}>
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className="flex items-center justify-between p-3 rounded-lg bg-white/10 cursor-pointer hover:bg-white/20 transition-colors"
                  onClick={() => setEditingName(true)}
                >
                  <span className="text-white">{profile?.full_name || "Not set"}</span>
                  <span className="text-xs text-white/50">Tap to edit</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-white/70 text-sm">{t('settings.phone')}</Label>
              <div className="p-3 rounded-lg bg-white/10">
                <span className="text-white">{profile?.phone || "Not available"}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70 text-sm">{t('settings.kycStatus')}</Label>
              <div className="flex items-center gap-2">
                <Badge variant={profile?.kyc_status === 'verified' ? 'default' : 'secondary'}>
                  {profile?.kyc_status === 'verified' ? t('settings.verified') : t('settings.pending')}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Language Section */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-white">
              <Globe className="h-4 w-4 text-primary" />
              {t('settings.language')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={selectedLanguage === 'en' ? 'default' : 'outline'}
                className={cn(
                  "h-12 justify-start gap-2",
                  selectedLanguage !== 'en' && "bg-white/10 border-white/30 text-white hover:bg-white/20"
                )}
                onClick={() => handleLanguageChange('en')}
              >
                <span className="text-lg">🇬🇧</span>
                {t('settings.english')}
                {selectedLanguage === 'en' && <Check className="h-4 w-4 ml-auto" />}
              </Button>
              <Button
                variant={selectedLanguage === 'hi' ? 'default' : 'outline'}
                className={cn(
                  "h-12 justify-start gap-2",
                  selectedLanguage !== 'hi' && "bg-white/10 border-white/30 text-white hover:bg-white/20"
                )}
                onClick={() => handleLanguageChange('hi')}
              >
                <span className="text-lg">🇮🇳</span>
                {t('settings.hindi')}
                {selectedLanguage === 'hi' && <Check className="h-4 w-4 ml-auto" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notifications Section */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-white">
              <Bell className="h-4 w-4 text-primary" />
              {t('settings.notifications')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-white">{t('settings.smsNotifications')}</Label>
                <p className="text-sm text-white/60">{t('settings.smsNotificationsDesc')}</p>
              </div>
              <Switch
                checked={smsNotifications}
                onCheckedChange={handleSmsToggle}
              />
            </div>
            <Separator className="bg-white/20" />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-white">{t('settings.promoNotifications')}</Label>
                <p className="text-sm text-white/60">{t('settings.promoNotificationsDesc')}</p>
              </div>
              <Switch
                checked={promoNotifications}
                onCheckedChange={handlePromoToggle}
              />
            </div>
          </CardContent>
        </Card>

        {/* Appearance Section */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-white">
              <Palette className="h-4 w-4 text-primary" />
              {t('settings.appearance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                className={cn("h-12 flex-col gap-1", theme !== 'light' && "bg-white/10 border-white/30 text-white hover:bg-white/20")}
                onClick={() => handleThemeChange('light')}
              >
                <Sun className="h-4 w-4" />
                <span className="text-xs">{t('settings.light')}</span>
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                className={cn("h-12 flex-col gap-1", theme !== 'dark' && "bg-white/10 border-white/30 text-white hover:bg-white/20")}
                onClick={() => handleThemeChange('dark')}
              >
                <Moon className="h-4 w-4" />
                <span className="text-xs">{t('settings.dark')}</span>
              </Button>
              <Button
                variant={theme === 'system' ? 'default' : 'outline'}
                className={cn("h-12 flex-col gap-1", theme !== 'system' && "bg-white/10 border-white/30 text-white hover:bg-white/20")}
                onClick={() => handleThemeChange('system')}
              >
                <Monitor className="h-4 w-4" />
                <span className="text-xs">{t('settings.system')}</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links Section */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-white">
              <LinkIcon className="h-4 w-4 text-primary" />
              {t('settings.quickLinks')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <Button variant="ghost" className="w-full justify-between h-12 text-white hover:bg-white/10" asChild>
              <a href="/Privacypolicy" target="_blank">

                {t('settings.privacyPolicy')}
                <ExternalLink className="h-4 w-4 text-white/50" />
              </a>
            </Button>
            <Button variant="ghost" className="w-full justify-between h-12 text-white hover:bg-white/10" asChild>
              <a href="/Termsandconditions" target="_blank">
                {t('settings.termsOfService')}
                <ExternalLink className="h-4 w-4 text-white/50" />
              </a>
            </Button>
            <Button variant="ghost" className="w-full justify-between h-12 text-white hover:bg-white/10">
              {t('settings.rateApp')}
              <Star className="h-4 w-4 text-white/50" />
            </Button>
            <Button variant="ghost" className="w-full justify-between h-12 text-white hover:bg-white/10" onClick={handleShare}>
              {t('settings.shareApp')}
              <Share2 className="h-4 w-4 text-white/50" />
            </Button>
            <Separator className="my-2 bg-white/20" />
            <div className="flex items-center justify-between px-4 py-2 text-sm text-white/60">
              <span>{t('settings.appVersion')}</span>
              <span>1.0.0</span>
            </div>
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-white">
              <User className="h-4 w-4 text-primary" />
              {t('settings.account')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2 h-12 bg-white/10 border-white/30 text-white hover:bg-white/20"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              {t('settings.logout')}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 h-12 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('settings.deleteAccount')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('settings.deleteAccount')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('settings.deleteAccountConfirm')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('settings.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => navigate('/delete-account')}
                  >
                    {t('settings.confirm')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};

export default Settings;