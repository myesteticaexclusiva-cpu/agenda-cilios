CREATE TABLE `appointment_slots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appointmentId` int NOT NULL,
	`professionalId` int NOT NULL,
	`slotStart` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `appointment_slots_id` PRIMARY KEY(`id`),
	CONSTRAINT `appointment_slots_professional_start_unique` UNIQUE(`professionalId`,`slotStart`)
);
--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`clientId` int NOT NULL,
	`professionalId` int NOT NULL,
	`serviceId` int NOT NULL,
	`startAt` timestamp NOT NULL,
	`endAt` timestamp NOT NULL,
	`appointment_status` enum('pending','confirmed','cancelled','completed','no_show') NOT NULL DEFAULT 'pending',
	`source` enum('public','admin') NOT NULL DEFAULT 'public',
	`notes` text,
	`cancellationReason` text,
	`confirmedAt` timestamp,
	`cancelledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appointments_id` PRIMARY KEY(`id`),
	CONSTRAINT `appointments_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`email` varchar(320),
	`whatsappOptIn` boolean NOT NULL DEFAULT false,
	`optInAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`),
	CONSTRAINT `clients_phone_unique` UNIQUE(`phone`)
);
--> statement-breakpoint
CREATE TABLE `message_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appointmentId` int NOT NULL,
	`templateId` int,
	`message_kind` enum('confirmation','reminder_24h','reminder_same_day') NOT NULL,
	`idempotencyKey` varchar(100) NOT NULL,
	`scheduledFor` timestamp NOT NULL,
	`message_status` enum('queued','sending','sent','failed','skipped') NOT NULL DEFAULT 'queued',
	`attempts` int NOT NULL DEFAULT 0,
	`providerMessageId` varchar(160),
	`lastError` text,
	`payload` json,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `message_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `message_deliveries_idempotency_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `message_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`message_kind` enum('confirmation','reminder_24h','reminder_same_day') NOT NULL,
	`name` varchar(120) NOT NULL,
	`content` text NOT NULL,
	`metaTemplateName` varchar(512),
	`languageCode` varchar(16) NOT NULL DEFAULT 'pt_BR',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `message_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `message_templates_kind_unique` UNIQUE(`message_kind`)
);
--> statement-breakpoint
CREATE TABLE `professional_breaks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`professionalId` int NOT NULL,
	`dayOfWeek` int NOT NULL,
	`startTime` varchar(5) NOT NULL,
	`endTime` varchar(5) NOT NULL,
	`label` varchar(80) NOT NULL DEFAULT 'Intervalo',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `professional_breaks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `professional_work_hours` (
	`id` int AUTO_INCREMENT NOT NULL,
	`professionalId` int NOT NULL,
	`dayOfWeek` int NOT NULL,
	`startTime` varchar(5) NOT NULL,
	`endTime` varchar(5) NOT NULL,
	`isWorking` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `professional_work_hours_id` PRIMARY KEY(`id`),
	CONSTRAINT `work_hours_professional_day_unique` UNIQUE(`professionalId`,`dayOfWeek`)
);
--> statement-breakpoint
CREATE TABLE `professionals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`position` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`roleLabel` varchar(120) NOT NULL DEFAULT 'Lash designer',
	`color` varchar(16) NOT NULL DEFAULT '#9D6E60',
	`bio` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `professionals_id` PRIMARY KEY(`id`),
	CONSTRAINT `professionals_position_unique` UNIQUE(`position`)
);
--> statement-breakpoint
CREATE TABLE `salon_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`salonName` varchar(160) NOT NULL DEFAULT 'Ateliê de Cílios',
	`timezone` varchar(64) NOT NULL DEFAULT 'America/Sao_Paulo',
	`sameDayReminderTime` varchar(5) NOT NULL DEFAULT '09:00',
	`whatsappPhoneNumberId` varchar(80),
	`whatsappBusinessAccountId` varchar(80),
	`whatsappEnabled` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `salon_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`durationMinutes` int NOT NULL,
	`priceCents` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','user') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `appointment_slots` ADD CONSTRAINT `appointment_slots_appointmentId_appointments_id_fk` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment_slots` ADD CONSTRAINT `appointment_slots_professionalId_professionals_id_fk` FOREIGN KEY (`professionalId`) REFERENCES `professionals`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_professionalId_professionals_id_fk` FOREIGN KEY (`professionalId`) REFERENCES `professionals`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_serviceId_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `message_deliveries` ADD CONSTRAINT `message_deliveries_appointmentId_appointments_id_fk` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `message_deliveries` ADD CONSTRAINT `message_deliveries_templateId_message_templates_id_fk` FOREIGN KEY (`templateId`) REFERENCES `message_templates`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `professional_breaks` ADD CONSTRAINT `professional_breaks_professionalId_professionals_id_fk` FOREIGN KEY (`professionalId`) REFERENCES `professionals`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `professional_work_hours` ADD CONSTRAINT `professional_work_hours_professionalId_professionals_id_fk` FOREIGN KEY (`professionalId`) REFERENCES `professionals`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `appointment_slots_appointment_idx` ON `appointment_slots` (`appointmentId`);--> statement-breakpoint
CREATE INDEX `appointments_professional_start_idx` ON `appointments` (`professionalId`,`startAt`);--> statement-breakpoint
CREATE INDEX `appointments_client_start_idx` ON `appointments` (`clientId`,`startAt`);--> statement-breakpoint
CREATE INDEX `appointments_status_idx` ON `appointments` (`appointment_status`);--> statement-breakpoint
CREATE INDEX `clients_name_idx` ON `clients` (`name`);--> statement-breakpoint
CREATE INDEX `message_deliveries_status_schedule_idx` ON `message_deliveries` (`message_status`,`scheduledFor`);--> statement-breakpoint
CREATE INDEX `message_deliveries_appointment_idx` ON `message_deliveries` (`appointmentId`);--> statement-breakpoint
CREATE INDEX `breaks_professional_day_idx` ON `professional_breaks` (`professionalId`,`dayOfWeek`);--> statement-breakpoint
CREATE INDEX `services_active_sort_idx` ON `services` (`isActive`,`sortOrder`);