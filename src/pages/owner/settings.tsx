import { OwnerLayout } from "@/components/layout/owner-layout";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Percent, DollarSign, Clock, Smartphone, RotateCcw, Mail, CheckCircle2, Loader2 } from "lucide-react";
import { useOwnerAuth } from "@/components/owner-auth-provider";

export default function Settings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { password: ownerPw } = useOwnerAuth();
  const [summaryStatus, setSummaryStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const { data: settings, isLoading } = useGetSettings({
    query: { queryKey: getGetSettingsQueryKey() }
  });

  const updateSettings = useUpdateSettings();

  const [shopName, setShopName] = useState("");
  const [siteDescription, setSiteDescription] = useState("");
  const [readyMessage, setReadyMessage] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [announcementEnabled, setAnnouncementEnabled] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");
  const [happyHourEnabled, setHappyHourEnabled] = useState(true);
  const [happyHourStart, setHappyHourStart] = useState("15:00");
  const [happyHourEnd, setHappyHourEnd] = useState("17:00");
  const [happyHourDiscountType, setHappyHourDiscountType] = useState("percent");
  const [happyHourDiscountValue, setHappyHourDiscountValue] = useState("50");

  // POS appearance
  const [posAccentColor, setPosAccentColor] = useState("#F9AF94");
  const [posBgColor, setPosBgColor] = useState("#FFF3EB");
  const [posCardColor, setPosCardColor] = useState("#FFFFFF");
  const [posForegroundColor, setPosForegroundColor] = useState("#4D2A1A");
  const [posMutedColor, setPosMutedColor] = useState("#945D42");
  const [posBorderColor, setPosBorderColor] = useState("#E2D2CA");
  const [posHeaderText, setPosHeaderText] = useState("");
  const [posButtonRadius, setPosButtonRadius] = useState("16");

  useEffect(() => {
    if (settings) {
      setShopName(settings.shopName);
      setSiteDescription(settings.siteDescription);
      setReadyMessage(settings.readyMessage);
      setOwnerPassword(settings.ownerPassword);
      // The API returns `isOpen` as the *effective* state (manual AND within hours).
      // The toggle should reflect the manual override, which is `manualOpen`.
      const s = settings as typeof settings & {
        manualOpen?: boolean;
        happyHourEnabled?: boolean;
        happyHourStart?: string;
        happyHourEnd?: string;
        happyHourDiscountType?: string;
        happyHourDiscountValue?: string;
      };
      setIsOpen(typeof s.manualOpen === "boolean" ? s.manualOpen : settings.isOpen);
      setAnnouncementEnabled(settings.announcementEnabled);
      setAnnouncementText(settings.announcementText);
      setHappyHourEnabled(s.happyHourEnabled ?? true);
      setHappyHourStart(s.happyHourStart ?? "15:00");
      setHappyHourEnd(s.happyHourEnd ?? "17:00");
      setHappyHourDiscountType(s.happyHourDiscountType ?? "percent");
      setHappyHourDiscountValue(s.happyHourDiscountValue ?? "50");
      const ps = settings as typeof settings & {
        posAccentColor?: string; posBgColor?: string; posCardColor?: string;
        posForegroundColor?: string; posMutedColor?: string; posBorderColor?: string;
        posHeaderText?: string; posButtonRadius?: string;
      };
      setPosAccentColor(ps.posAccentColor ?? "#F9AF94");
      setPosBgColor(ps.posBgColor ?? "#FFF3EB");
      setPosCardColor(ps.posCardColor ?? "#FFFFFF");
      setPosForegroundColor(ps.posForegroundColor ?? "#4D2A1A");
      setPosMutedColor(ps.posMutedColor ?? "#945D42");
      setPosBorderColor(ps.posBorderColor ?? "#E2D2CA");
      setPosHeaderText(ps.posHeaderText ?? "");
      setPosButtonRadius(ps.posButtonRadius ?? "16");
    }
  }, [settings]);

  const handleSendSummary = async (daysAgo: number) => {
    setSummaryStatus("sending");
    try {
      const res = await fetch("/api/admin/daily-summary/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-owner-password": ownerPw },
        body: JSON.stringify({ daysAgo }),
      });
      if (!res.ok) throw new Error("Failed");
      setSummaryStatus("sent");
      toast({ title: "Summary Sent!", description: `Daily summary email is on its way to ${import.meta.env.VITE_SUMMARY_EMAIL ?? "your inbox"}.` });
      setTimeout(() => setSummaryStatus("idle"), 4000);
    } catch {
      setSummaryStatus("error");
      toast({ title: "Send Failed", description: "Could not send the summary email. Check server logs.", variant: "destructive" });
      setTimeout(() => setSummaryStatus("idle"), 4000);
    }
  };

  const handleSave = () => {
    updateSettings.mutate({
      data: {
        shopName,
        siteDescription,
        readyMessage,
        ownerPassword,
        isOpen,
        announcementEnabled,
        announcementText,
        happyHourEnabled,
        happyHourStart,
        happyHourEnd,
        happyHourDiscountType,
        happyHourDiscountValue,
        posAccentColor,
        posBgColor,
        posCardColor,
        posForegroundColor,
        posMutedColor,
        posBorderColor,
        posHeaderText,
        posButtonRadius,
      }
    }, {
      onSuccess: () => {
        toast({
          title: "Settings Saved",
          description: "Shop settings have been updated successfully.",
        });
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      }
    });
  };

  if (isLoading) {
    return <OwnerLayout><div className="p-8 text-center text-muted-foreground">Loading settings...</div></OwnerLayout>;
  }

  return (
    <OwnerLayout>
      <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary-foreground">Shop Settings</h1>
          <p className="text-muted-foreground mt-1">Configure your storefront and notifications.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Store Status</CardTitle>
            <CardDescription>Control whether customers can place new orders.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Switch
                id="is-open"
                checked={isOpen}
                onCheckedChange={setIsOpen}
              />
              <Label htmlFor="is-open" className="text-base">{isOpen ? "Accepting Orders" : "Store Closed"}</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Storefront</CardTitle>
            <CardDescription>What customers see on the main menu page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shopName">Shop Name</Label>
              <Input
                id="shopName"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteDescription">Tagline / Description</Label>
              <Textarea
                id="siteDescription"
                value={siteDescription}
                onChange={(e) => setSiteDescription(e.target.value)}
                rows={2}
                placeholder="A short description shown under the hero heading on your menu page."
              />
              <p className="text-xs text-muted-foreground">
                Shown under the "Sip Something Sweet" heading on the customer menu page.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Announcement Banner</CardTitle>
            <CardDescription>Pin a message at the top of the customer menu page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="announcement-enabled"
                checked={announcementEnabled}
                onCheckedChange={setAnnouncementEnabled}
              />
              <Label htmlFor="announcement-enabled" className="text-base">
                {announcementEnabled ? "Banner is live" : "Banner is hidden"}
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="announcementText">Announcement Message</Label>
              <Textarea
                id="announcementText"
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                rows={2}
                placeholder="e.g. We're closed Monday July 4th. Happy Independence Day! 🎆"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="readyMessage">Order Ready Email Message</Label>
              <Textarea
                id="readyMessage"
                value={readyMessage}
                onChange={(e) => setReadyMessage(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Use {"{name}"} to insert the customer's name. Sent via email when their order is marked ready.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Happy Hour Discount
            </CardTitle>
            <CardDescription>
              Automatically apply a discount during set hours. Customers see the discount live at checkout.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center space-x-2">
              <Switch
                id="happy-hour-enabled"
                checked={happyHourEnabled}
                onCheckedChange={setHappyHourEnabled}
              />
              <Label htmlFor="happy-hour-enabled" className="text-base">
                {happyHourEnabled ? "Happy Hour is active during set hours" : "Happy Hour is disabled"}
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hhStart">Start Time</Label>
                <Input
                  id="hhStart"
                  type="time"
                  value={happyHourStart}
                  onChange={(e) => setHappyHourStart(e.target.value)}
                  disabled={!happyHourEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hhEnd">End Time</Label>
                <Input
                  id="hhEnd"
                  type="time"
                  value={happyHourEnd}
                  onChange={(e) => setHappyHourEnd(e.target.value)}
                  disabled={!happyHourEnabled}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Discount Type</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setHappyHourDiscountType("percent")}
                  disabled={!happyHourEnabled}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-md border py-2 px-3 text-sm font-medium transition-colors ${
                    happyHourDiscountType === "percent"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white text-muted-foreground border-border hover:border-primary/50"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Percent className="h-4 w-4" /> Percent Off
                </button>
                <button
                  type="button"
                  onClick={() => setHappyHourDiscountType("dollar")}
                  disabled={!happyHourEnabled}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-md border py-2 px-3 text-sm font-medium transition-colors ${
                    happyHourDiscountType === "dollar"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white text-muted-foreground border-border hover:border-primary/50"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <DollarSign className="h-4 w-4" /> Dollar Off
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hhValue">
                {happyHourDiscountType === "percent" ? "Discount Percentage" : "Discount Amount ($)"}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  {happyHourDiscountType === "percent" ? "%" : "$"}
                </span>
                <Input
                  id="hhValue"
                  type="number"
                  min="0"
                  max={happyHourDiscountType === "percent" ? "100" : undefined}
                  step={happyHourDiscountType === "percent" ? "1" : "0.01"}
                  value={happyHourDiscountValue}
                  onChange={(e) => setHappyHourDiscountValue(e.target.value)}
                  disabled={!happyHourEnabled}
                  className="pl-8"
                />
              </div>
              {happyHourEnabled && (
                <p className="text-xs text-muted-foreground">
                  Preview: customers get{" "}
                  <strong>
                    {happyHourDiscountType === "percent"
                      ? `${happyHourDiscountValue}% off`
                      : `$${Number(happyHourDiscountValue).toFixed(2)} off`}
                  </strong>{" "}
                  their order from {happyHourStart} to {happyHourEnd} CT.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              POS Appearance
            </CardTitle>
            <CardDescription>
              Customize how the POS app looks on the tablet or phone used by staff.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Live preview */}
            <div className="rounded-2xl overflow-hidden border shadow-sm" style={{ background: posBgColor }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ background: posCardColor, borderBottom: `1px solid ${posBorderColor}` }}>
                <span className="font-bold text-base" style={{ color: posForegroundColor, fontFamily: "serif" }}>
                  {posHeaderText || shopName || "Sweet Street"}
                </span>
                <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: posAccentColor }}>
                  <span className="text-xs font-bold" style={{ color: posForegroundColor }}>POS</span>
                </div>
              </div>
              <div className="p-4 grid grid-cols-2 gap-2">
                {["Dirty Soda", "Lotus Energy", "Coffee", "Sweet Treat"].map((name) => (
                  <div key={name} className="rounded-xl p-3 flex flex-col gap-1.5" style={{ background: posCardColor, border: `1px solid ${posBorderColor}` }}>
                    <div className="h-8 w-8 rounded-lg" style={{ background: posAccentColor, opacity: 0.3 }} />
                    <span className="text-xs font-semibold" style={{ color: posForegroundColor }}>{name}</span>
                    <span className="text-xs" style={{ color: posMutedColor }}>$5.00</span>
                    <div className="mt-1 rounded-lg py-1 text-center text-xs font-bold" style={{ background: posAccentColor, color: posForegroundColor, borderRadius: `${Math.min(Number(posButtonRadius), 20)}px` }}>
                      Add
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Color pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: "Accent / Button Color", value: posAccentColor, onChange: setPosAccentColor, hint: "Used for buttons and highlights" },
                { label: "Background Color", value: posBgColor, onChange: setPosBgColor, hint: "Main screen background" },
                { label: "Card / Surface Color", value: posCardColor, onChange: setPosCardColor, hint: "Menu item cards and header" },
                { label: "Text Color", value: posForegroundColor, onChange: setPosForegroundColor, hint: "Primary text and labels" },
                { label: "Muted Text Color", value: posMutedColor, onChange: setPosMutedColor, hint: "Prices, descriptions, secondary text" },
                { label: "Border Color", value: posBorderColor, onChange: setPosBorderColor, hint: "Card outlines and dividers" },
              ].map(({ label, value, onChange, hint }) => (
                <div key={label} className="space-y-1.5">
                  <Label className="text-sm font-medium">{label}</Label>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input
                        type="color"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5 bg-white"
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="#F9AF94"
                        className="font-mono text-sm h-9"
                        maxLength={7}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
              ))}
            </div>

            {/* Button radius */}
            <div className="space-y-2">
              <Label htmlFor="posButtonRadius">Button Corner Radius</Label>
              <div className="flex items-center gap-4">
                <input
                  id="posButtonRadius"
                  type="range"
                  min="0"
                  max="28"
                  value={posButtonRadius}
                  onChange={(e) => setPosButtonRadius(e.target.value)}
                  className="flex-1 accent-primary"
                />
                <span className="w-10 text-center text-sm font-mono text-muted-foreground">{posButtonRadius}px</span>
              </div>
              <p className="text-xs text-muted-foreground">Controls how rounded buttons and cards appear in the POS.</p>
            </div>

            {/* Header text */}
            <div className="space-y-2">
              <Label htmlFor="posHeaderText">POS Header Name</Label>
              <Input
                id="posHeaderText"
                value={posHeaderText}
                onChange={(e) => setPosHeaderText(e.target.value)}
                placeholder={shopName || "Sweet Street"}
              />
              <p className="text-xs text-muted-foreground">
                The name shown at the top of the POS app. Leave blank to use the shop name.
              </p>
            </div>

            {/* Reset button */}
            <div>
              <button
                type="button"
                onClick={() => {
                  setPosAccentColor("#F9AF94");
                  setPosBgColor("#FFF3EB");
                  setPosCardColor("#FFFFFF");
                  setPosForegroundColor("#4D2A1A");
                  setPosMutedColor("#945D42");
                  setPosBorderColor("#E2D2CA");
                  setPosButtonRadius("16");
                  setPosHeaderText("");
                }}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to Sweet Street defaults
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Change the password used to access this dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="password">Owner Password</Label>
              <Input
                id="password"
                type="text"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail size={18} /> Daily Summary Email
            </CardTitle>
            <CardDescription>
              A summary of orders, revenue, and top items is automatically emailed to you every day at 6:00 AM (Meeker, OK time). You can also send one on-demand below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sent to: <span className="font-medium text-foreground">ldfarris2007@gmail.com</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => handleSendSummary(1)}
                disabled={summaryStatus === "sending"}
              >
                {summaryStatus === "sending" ? (
                  <><Loader2 size={14} className="animate-spin mr-2" /> Sending...</>
                ) : summaryStatus === "sent" ? (
                  <><CheckCircle2 size={14} className="mr-2 text-green-600" /> Sent!</>
                ) : (
                  <><Mail size={14} className="mr-2" /> Send Yesterday's Summary</>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => handleSendSummary(0)}
                disabled={summaryStatus === "sending"}
                className="text-muted-foreground"
              >
                Send Today So Far
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pb-8">
          <Button
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className="w-full md:w-auto"
          >
            {updateSettings.isPending ? "Saving..." : "Save All Settings"}
          </Button>
        </div>
      </div>
    </OwnerLayout>
  );
}
