CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appointmentId` int NOT NULL,
	`stripePaymentIntentId` varchar(100) NOT NULL,
	`amountCents` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'BRL',
	`paymentMethod` enum('card','pix') NOT NULL,
	`stripeFeesCents` int NOT NULL DEFAULT 0,
	`payment_status` enum('pending','succeeded','failed','cancelled') NOT NULL DEFAULT 'pending',
	`stripeChargeId` varchar(100),
	`lastError` text,
	`succeededAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_stripe_intent_unique` UNIQUE(`stripePaymentIntentId`)
);
--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_appointmentId_appointments_id_fk` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `payments_appointment_idx` ON `payments` (`appointmentId`);--> statement-breakpoint
CREATE INDEX `payments_status_idx` ON `payments` (`payment_status`);