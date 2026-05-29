import { OwnerLayout } from "@/components/layout/owner-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Star, Trash2, CheckCircle, XCircle, Clock, MessageSquare, Loader2, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { useOwnerAuth } from "@/components/owner-auth-provider";
import { motion, AnimatePresence } from "framer-motion";

type ReviewData = {
  id: number;
  reviewerName: string;
  rating: number;
  comment?: string | null;
  approved: string;
  createdAt: string;
  menuItemId?: number | null;
  orderId?: number | null;
  ownerReply?: string | null;
};

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${rating >= star ? "text-amber-400 fill-amber-400" : "text-muted-foreground/40 fill-muted"}`}
        />
      ))}
    </div>
  );
}

export default function ReviewsManagement() {
  const { password } = useOwnerAuth();
  const { toast } = useToast();
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [actionPending, setActionPending] = useState<number | null>(null);
  const [draftReplies, setDraftReplies] = useState<Record<number, { loading: boolean; reply: string | null; visible: boolean }>>({});
  const [replyAllLoading, setReplyAllLoading] = useState(false);
  const [replyAllCount, setReplyAllCount] = useState({ done: 0, total: 0 });

  const handleDraftReply = async (review: ReviewData) => {
    setDraftReplies(prev => ({ ...prev, [review.id]: { loading: true, reply: null, visible: true } }));
    try {
      const res = await fetch(`/api/reviews/${review.id}/buddy-reply`, {
        method: "POST",
        headers: { "x-owner-token": password || "" },
      });
      if (res.ok) {
        const { reply } = await res.json() as { reply: string };
        setDraftReplies(prev => ({ ...prev, [review.id]: { loading: false, reply, visible: true } }));
        // Update the review in local state so the saved reply persists without a reload
        setReviews(prev => prev.map(r => r.id === review.id ? { ...r, ownerReply: reply } : r));
      } else {
        setDraftReplies(prev => ({ ...prev, [review.id]: { loading: false, reply: null, visible: false } }));
        toast({ title: "Couldn't generate reply", variant: "destructive" });
      }
    } catch {
      setDraftReplies(prev => ({ ...prev, [review.id]: { loading: false, reply: null, visible: false } }));
      toast({ title: "Couldn't generate reply", variant: "destructive" });
    }
  };

  const handleDraftAllReplies = async () => {
    const toReply = filtered.filter((r) => !r.ownerReply && !draftReplies[r.id]?.reply);
    if (toReply.length === 0) {
      toast({ title: "All visible reviews already have replies." });
      return;
    }
    setReplyAllLoading(true);
    setReplyAllCount({ done: 0, total: toReply.length });
    await Promise.allSettled(
      toReply.map(async (review) => {
        setDraftReplies((prev) => ({ ...prev, [review.id]: { loading: true, reply: null, visible: true } }));
        try {
          const res = await fetch(`/api/reviews/${review.id}/buddy-reply`, {
            method: "POST",
            headers: { "x-owner-token": password || "" },
          });
          if (res.ok) {
            const { reply } = await res.json() as { reply: string };
            setDraftReplies((prev) => ({ ...prev, [review.id]: { loading: false, reply, visible: true } }));
            setReviews((prev) => prev.map((r) => r.id === review.id ? { ...r, ownerReply: reply } : r));
          } else {
            setDraftReplies((prev) => ({ ...prev, [review.id]: { loading: false, reply: null, visible: false } }));
          }
        } catch {
          setDraftReplies((prev) => ({ ...prev, [review.id]: { loading: false, reply: null, visible: false } }));
        } finally {
          setReplyAllCount((prev) => ({ ...prev, done: prev.done + 1 }));
        }
      })
    );
    setReplyAllLoading(false);
    toast({ title: "All replies saved!" });
  };

  const fetchReviews = async () => {
    try {
      const res = await fetch("/api/reviews/all", {
        headers: { "x-owner-token": password || "" },
      });
      if (res.ok) {
        const data: ReviewData[] = await res.json();
        setReviews(data);
      }
    } catch {
      toast({ title: "Failed to load reviews", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReviews(); }, []);

  const handleApprove = async (id: number) => {
    setActionPending(id);
    try {
      const res = await fetch(`/api/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-owner-token": password || "" },
        body: JSON.stringify({ approved: "approved" }),
      });
      if (res.ok) {
        setReviews((prev) => prev.map((r) => r.id === id ? { ...r, approved: "approved" } : r));
        toast({ title: "Review approved" });
      }
    } catch {
      toast({ title: "Failed to approve", variant: "destructive" });
    } finally {
      setActionPending(null);
    }
  };

  const handleReject = async (id: number) => {
    setActionPending(id);
    try {
      const res = await fetch(`/api/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-owner-token": password || "" },
        body: JSON.stringify({ approved: "rejected" }),
      });
      if (res.ok) {
        setReviews((prev) => prev.map((r) => r.id === id ? { ...r, approved: "rejected" } : r));
        toast({ title: "Review rejected" });
      }
    } catch {
      toast({ title: "Failed to reject", variant: "destructive" });
    } finally {
      setActionPending(null);
    }
  };

  const handleDelete = async (id: number) => {
    setActionPending(id);
    try {
      const res = await fetch(`/api/reviews/${id}`, {
        method: "DELETE",
        headers: { "x-owner-token": password || "" },
      });
      if (res.ok) {
        setReviews((prev) => prev.filter((r) => r.id !== id));
        toast({ title: "Review deleted" });
      }
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally {
      setActionPending(null);
    }
  };

  const filtered = reviews.filter((r) => filter === "all" ? true : r.approved === filter);
  const counts = {
    all: reviews.length,
    pending: reviews.filter((r) => r.approved === "pending").length,
    approved: reviews.filter((r) => r.approved === "approved").length,
    rejected: reviews.filter((r) => r.approved === "rejected").length,
  };

  const avgRating = reviews.filter((r) => r.approved === "approved").length > 0
    ? reviews.filter((r) => r.approved === "approved").reduce((s, r) => s + r.rating, 0) / reviews.filter((r) => r.approved === "approved").length
    : 0;

  return (
    <OwnerLayout>
      <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Customer Reviews</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and moderate customer feedback.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-white border border-border rounded-2xl shadow-sm">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Reviews</p>
              <p className="text-2xl font-bold text-foreground mt-1">{counts.all}</p>
            </CardContent>
          </Card>
          <Card className="bg-white border border-border rounded-2xl shadow-sm">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg. Rating</p>
              <div className="flex items-baseline gap-1 mt-1">
                <p className="text-2xl font-bold text-foreground">{avgRating > 0 ? avgRating.toFixed(1) : "—"}</p>
                {avgRating > 0 && <Star className="h-4 w-4 text-amber-400 fill-amber-400" />}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border border-border rounded-2xl shadow-sm border-l-4 border-l-amber-400">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending</p>
              <p className="text-2xl font-bold text-foreground mt-1">{counts.pending}</p>
            </CardContent>
          </Card>
          <Card className="bg-white border border-border rounded-2xl shadow-sm border-l-4 border-l-emerald-500">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Approved</p>
              <p className="text-2xl font-bold text-foreground mt-1">{counts.approved}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2 flex-wrap items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {(["all", "pending", "approved", "rejected"] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(f)}
                className={`capitalize rounded-xl ${filter === f ? 'bg-primary text-white hover:bg-primary/90 shadow-sm font-medium' : 'border border-border bg-white hover:bg-muted/50 text-foreground/80'}`}
              >
                {f}
                <Badge variant="secondary" className="ml-2 text-xs bg-muted text-foreground/90">{counts[f]}</Badge>
              </Button>
            ))}
          </div>
          {!loading && filtered.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="border-border text-foreground/80 bg-white hover:bg-muted/50 rounded-xl font-medium gap-1.5 shrink-0"
              disabled={replyAllLoading}
              onClick={handleDraftAllReplies}
            >
              {replyAllLoading ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {replyAllCount.done}/{replyAllCount.total} drafted…</>
              ) : (
                <>Draft All Replies</>
              )}
            </Button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse border border-border" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-border border-dashed rounded-2xl bg-white">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30 text-muted-foreground/70" />
            <p className="font-medium text-foreground/80">No {filter === "all" ? "" : filter} reviews yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((review) => (
                <motion.div
                  key={review.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.25 }}
                >
                  <Card className="bg-white border border-border rounded-2xl shadow-sm hover:border-border hover:shadow-md transition-all">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <p className="font-bold text-sm text-foreground">{review.reviewerName}</p>
                            <StarDisplay rating={review.rating} />
                            {review.approved === "pending" && (
                              <Badge className="bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-100 gap-1 text-xs">
                                <Clock className="h-3 w-3" /> Pending
                              </Badge>
                            )}
                            {review.approved === "approved" && (
                              <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 gap-1 text-xs">
                                <CheckCircle className="h-3 w-3" /> Approved
                              </Badge>
                            )}
                            {review.approved === "rejected" && (
                              <Badge className="bg-red-100 text-red-800 border border-red-200 hover:bg-red-100 gap-1 text-xs">
                                <XCircle className="h-3 w-3" /> Rejected
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs font-medium text-muted-foreground mt-1">
                            {new Date(review.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                          </p>
                          {review.comment && (
                            <p className="text-sm text-foreground/80 mt-2 leading-relaxed">{review.comment}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {review.approved !== "approved" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 h-8 text-xs rounded-lg font-medium bg-white"
                              disabled={actionPending === review.id}
                              onClick={() => handleApprove(review.id)}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" /> Approve
                            </Button>
                          )}
                          {review.approved !== "rejected" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-700 border-red-200 hover:bg-red-50 h-8 text-xs rounded-lg font-medium bg-white"
                              disabled={actionPending === review.id}
                              onClick={() => handleReject(review.id)}
                            >
                              <XCircle className="h-3 w-3 mr-1" /> Reject
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0 rounded-lg"
                            disabled={actionPending === review.id}
                            onClick={() => handleDelete(review.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Buddy Reply Section */}
                      <div className="mt-4 pt-4 border-t border-border/60 flex flex-col gap-2">
                        {/* Show saved reply from DB */}
                        {(review.ownerReply || (draftReplies[review.id]?.visible && draftReplies[review.id]?.reply)) && (
                          <div className="rounded-xl bg-muted/50 border border-border p-3">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                              <Sparkles className="h-3 w-3" /> AI Reply
                            </p>
                            <p className="text-sm font-medium text-foreground/90 leading-relaxed">
                              {draftReplies[review.id]?.reply || review.ownerReply}
                            </p>
                            <div className="flex gap-2 mt-3">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] rounded-lg border-border text-foreground/80 hover:bg-muted bg-white"
                                onClick={() => {
                                  const text = draftReplies[review.id]?.reply || review.ownerReply || "";
                                  navigator.clipboard.writeText(text);
                                  toast({ title: "Reply copied!" });
                                }}
                              >
                                Copy
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[11px] rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                                disabled={draftReplies[review.id]?.loading}
                                onClick={() => handleDraftReply(review)}
                              >
                                {draftReplies[review.id]?.loading
                                  ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Regenerating…</>
                                  : "Regenerate"
                                }
                              </Button>
                            </div>
                          </div>
                        )}
                        {/* No reply yet — show generate button */}
                        {!review.ownerReply && !draftReplies[review.id]?.reply && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-fit rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted h-7 text-xs px-2 font-medium"
                            disabled={draftReplies[review.id]?.loading}
                            onClick={() => handleDraftReply(review)}
                          >
                            {draftReplies[review.id]?.loading
                              ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Writing reply…</>
                              : "Generate Reply"
                            }
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </OwnerLayout>
  );
}
