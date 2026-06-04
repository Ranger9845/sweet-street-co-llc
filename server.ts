import express from "express";
import type { Request, Response } from "express";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// API handlers
import ordersHandler from "./api/orders/index.js";
import orderStatsHandler from "./api/orders/stats.js";
import orderPopularItemsHandler from "./api/orders/popular-items.js";
import autoBumpHandler from "./api/orders/sweet-street-buddy/auto-bump.js";
import dailySpecialHandler from "./api/orders/sweet-street-buddy/daily-special.js";
import lowPerformerAlertsHandler from "./api/orders/sweet-street-buddy/low-performer-alerts.js";
import pushUpdateHandler from "./api/orders/sweet-street-buddy/push-update.js";
import orderByIdHandler from "./api/orders/[id]/index.js";
import orderBumpHandler from "./api/orders/[id]/bump.js";
import orderStatusHandler from "./api/orders/[id]/status.js";
import menuItemsHandler from "./api/menu-items.js";
import menuItemByIdHandler from "./api/menu-items/[id].js";
import modifiersHandler from "./api/modifiers.js";
import reviewsAllHandler from "./api/reviews/all.js";
import reviewsHandler from "./api/reviews.js";
import rewardsHandler from "./api/rewards.js";
import settingsHandler from "./api/settings.js";
import favoritesHandler from "./api/favorites.js";
import pointsByUserHandler from "./api/points/[userId].js";
import pointsUnseenEarningsHandler from "./api/points/[userId]/unseen-earnings.js";
import pointsMarkSeenHandler from "./api/points/[userId]/mark-earnings-seen.js";
import feedbackHandler from "./api/feedback.js";
import liveCartsHandler from "./api/live-carts.js";
import visitorsHeartbeatHandler from "./api/visitors/heartbeat.js";
import visitorsCountHandler from "./api/visitors/count.js";
import paymentsConfigHandler from "./api/payments/config.js";
import paymentsProcessHandler from "./api/payments/process.js";
import paymentsPoscashHandler from "./api/payments/pos/cash.js";
import discountCodesValidateHandler from "./api/discount-codes/validate.js";
import discountCodesHandler from "./api/discount-codes/index.js";
import discountCodeByIdHandler from "./api/discount-codes/[id].js";
import posCategoryByIdHandler from "./api/pos/categories/[id].js";
import posCategoriesHandler from "./api/pos/categories.js";
import posItemAssignmentsHandler from "./api/pos-item-assignments.js";
import adminDailySummaryHandler from "./api/admin/daily-summary/send.js";
import ownerVerifyHandler from "./api/owner/verify.js";
import ownerApiTokenHandler from "./api/owner/api-token.js";
import ownerAllowedEmailsHandler from "./api/owner/allowed-emails.js";
import authVerifyOwnerHandler from "./api/auth/verify-owner.js";
import sendFixEmailHandler from "./api/send-fix-email.js";
import loyaltyAccountHandler from "./api/loyalty/account.js";
import loyaltyAccumulateHandler from "./api/loyalty/accumulate.js";
import loyaltyAdjustHandler from "./api/loyalty/adjust.js";
import userProfileHandler from "./api/user/profile.js";
import squareActiveOrdersHandler from "./api/square/active-orders.js";
import squareRecentOrdersHandler from "./api/square/recent-orders.js";
import squareSyncOrdersHandler from "./api/square/sync-orders.js";
import inventoryCatalogHandler from "./api/inventory/catalog.js";
import inventorySearchHandler from "./api/inventory/search.js";
import inventoryReceiveHandler from "./api/inventory/receive.js";
import inventoryReportHandler from "./api/inventory/report.js";
import giftCardsPurchaseHandler from "./api/gift-cards/purchase.js";
import giftCardsBalanceHandler from "./api/gift-cards/balance.js";
import giftCardsRedeemHandler from "./api/gift-cards/redeem.js";

const app = express();
app.use(express.json());

// Merges Express path params into req.query so handlers can use req.query.id
// the same way they do on Vercel (where Vercel injects dynamic segments into query).
function adapt(
  handler: (req: VercelRequest, res: VercelResponse) => unknown,
  paramKeys: string[] = [],
) {
  return async (req: Request, res: Response, next: import("express").NextFunction) => {
    for (const key of paramKeys) {
      if (req.params[key] !== undefined) {
        (req.query as Record<string, string>)[key] = req.params[key];
      }
    }
    try {
      await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);
    } catch (err) {
      next(err);
    }
  };
}

// Orders — specific paths before dynamic :id
app.all("/api/orders/stats", adapt(orderStatsHandler));
app.all("/api/orders/popular-items", adapt(orderPopularItemsHandler));
app.all("/api/orders/sweet-street-buddy/auto-bump", adapt(autoBumpHandler));
app.all("/api/orders/sweet-street-buddy/daily-special", adapt(dailySpecialHandler));
app.all("/api/orders/sweet-street-buddy/low-performer-alerts", adapt(lowPerformerAlertsHandler));
app.all("/api/orders/sweet-street-buddy/push-update", adapt(pushUpdateHandler));
app.all("/api/orders/:id/bump", adapt(orderBumpHandler, ["id"]));
app.all("/api/orders/:id/status", adapt(orderStatusHandler, ["id"]));
app.all("/api/orders/:id", adapt(orderByIdHandler, ["id"]));
app.all("/api/orders", adapt(ordersHandler));

// Menu
app.all("/api/menu-items/:id", adapt(menuItemByIdHandler, ["id"]));
app.all("/api/menu-items", adapt(menuItemsHandler));
app.all("/api/modifiers", adapt(modifiersHandler));

// Reviews
app.all("/api/reviews/all", adapt(reviewsAllHandler));
app.all("/api/reviews", adapt(reviewsHandler));

// Misc
app.all("/api/rewards", adapt(rewardsHandler));
app.all("/api/settings", adapt(settingsHandler));
app.all("/api/favorites", adapt(favoritesHandler));
app.all("/api/points/:userId/unseen-earnings", adapt(pointsUnseenEarningsHandler, ["userId"]));
app.all("/api/points/:userId/mark-earnings-seen", adapt(pointsMarkSeenHandler, ["userId"]));
app.all("/api/points/:userId", adapt(pointsByUserHandler, ["userId"]));
app.all("/api/feedback", adapt(feedbackHandler));
app.all("/api/live-carts", adapt(liveCartsHandler));

// Visitors
app.all("/api/visitors/heartbeat", adapt(visitorsHeartbeatHandler));
app.all("/api/visitors/count", adapt(visitorsCountHandler));

// Payments
app.all("/api/payments/config", adapt(paymentsConfigHandler));
app.all("/api/payments/process", adapt(paymentsProcessHandler));
app.all("/api/payments/pos/cash", adapt(paymentsPoscashHandler));

// Square Loyalty
app.all("/api/loyalty/account", adapt(loyaltyAccountHandler));
app.all("/api/loyalty/accumulate", adapt(loyaltyAccumulateHandler));
app.all("/api/loyalty/adjust", adapt(loyaltyAdjustHandler));

// Square POS Orders
app.all("/api/square/active-orders", adapt(squareActiveOrdersHandler));
app.all("/api/square/recent-orders", adapt(squareRecentOrdersHandler));
app.all("/api/square/sync-orders", adapt(squareSyncOrdersHandler));

// Gift Cards
app.all("/api/gift-cards/purchase", adapt(giftCardsPurchaseHandler));
app.all("/api/gift-cards/balance", adapt(giftCardsBalanceHandler));
app.all("/api/gift-cards/redeem", adapt(giftCardsRedeemHandler));

// Inventory
app.all("/api/inventory/catalog", adapt(inventoryCatalogHandler));
app.all("/api/inventory/search", adapt(inventorySearchHandler));
app.all("/api/inventory/receive", adapt(inventoryReceiveHandler));
app.all("/api/inventory/report", adapt(inventoryReportHandler));

// Discount codes
app.all("/api/discount-codes/validate", adapt(discountCodesValidateHandler));
app.all("/api/discount-codes/:id", adapt(discountCodeByIdHandler, ["id"]));
app.all("/api/discount-codes", adapt(discountCodesHandler));

// POS — specific paths before dynamic :id
app.all("/api/pos/categories/:id", adapt(posCategoryByIdHandler, ["id"]));
app.all("/api/pos/categories", adapt(posCategoriesHandler));
app.all("/api/pos-item-assignments", adapt(posItemAssignmentsHandler));

// Admin
app.all("/api/admin/daily-summary/send", adapt(adminDailySummaryHandler));

// Auth
app.all("/api/owner/verify", adapt(ownerVerifyHandler));
app.all("/api/owner/api-token", adapt(ownerApiTokenHandler));
app.all("/api/owner/allowed-emails", adapt(ownerAllowedEmailsHandler));
app.all("/api/auth/verify-owner", adapt(authVerifyOwnerHandler));
app.all("/api/send-fix-email", adapt(sendFixEmailHandler));
app.all("/api/user/profile", adapt(userProfileHandler));

// SSE endpoint — pushes a heartbeat every 15s so the order board
// invalidates its queries and stays live without polling overhead.
app.get("/api/events/orders", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();
  res.write("data: connected\n\n");
  const timer = setInterval(() => res.write("data: ping\n\n"), 15000);
  req.on("close", () => clearInterval(timer));
});

// Health check
app.get("/health", (_req, res) => res.json({ ok: true }));

// Catch unhandled errors so the server doesn't crash on bad requests
app.use((err: Error, _req: import("express").Request, res: import("express").Response, _next: import("express").NextFunction) => {
  console.error(err.message);
  res.status(500).json({ error: err.message });
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

const PORT = Number(process.env.PORT ?? 10000);
app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});
