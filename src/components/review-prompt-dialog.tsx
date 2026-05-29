import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ReviewPromptDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: number;
  customerName: string;
}

const STORAGE_PREFIX = "ss_review_prompted_";

export function markReviewPrompted(orderId: number) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${orderId}`, "1");
  } catch {}
}

export function hasBeenPrompted(orderId: number): boolean {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${orderId}`) === "1";
  } catch {
    return false;
  }
}

export function ReviewPromptDialog({ open, onClose, orderId, customerName }: ReviewPromptDialogProps) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [name, setName] = useState(customerName);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { setError("Please select a star rating."); return; }
    if (!comment.trim()) { setError("Please write something about your experience."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewerName: name.trim() || customerName, rating, comment: comment.trim(), orderId }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({}));
        setError(msg || "Something went wrong. Please try again.");
      } else {
        setSubmitted(true);
        markReviewPrompted(orderId);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    markReviewPrompted(orderId);
    onClose();
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      markReviewPrompted(orderId);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="thanks"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-6 text-center space-y-3"
            >
              <div className="text-4xl">🎉</div>
              <h2 className="text-xl font-serif font-semibold text-primary-foreground">Thank you!</h2>
              <p className="text-muted-foreground text-sm">Your review means a lot to us.</p>
              <Button className="mt-2" onClick={onClose}>Close</Button>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">How was your order?</DialogTitle>
                <DialogDescription>
                  We'd love to hear what you think, {customerName.split(" ")[0]}!
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                {/* Star rating */}
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHovered(star)}
                      onMouseLeave={() => setHovered(0)}
                      className="transition-transform hover:scale-110 focus:outline-none"
                    >
                      <Star
                        className={`h-9 w-9 transition-colors ${
                          star <= (hovered || rating)
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  <Input
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <Textarea
                    placeholder="Tell us about your experience…"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    className="resize-none"
                    required
                  />
                </div>

                {error && <p className="text-xs text-destructive">{error}</p>}

                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="ghost" className="flex-1 text-muted-foreground" onClick={handleSkip} disabled={loading}>
                    Maybe later
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? "Submitting…" : "Submit Review"}
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
