/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19-11.4.8-MariaDB, for Win64 (AMD64)
--
-- Host: 127.0.0.1    Database: easyappointments
-- ------------------------------------------------------
-- Server version	11.4.8-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Table structure for table `ea_appointments`
--

DROP TABLE IF EXISTS `ea_appointments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ea_appointments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `create_datetime` datetime DEFAULT NULL,
  `update_datetime` datetime DEFAULT NULL,
  `book_datetime` datetime DEFAULT NULL,
  `start_datetime` datetime DEFAULT NULL,
  `end_datetime` datetime DEFAULT NULL,
  `location` text DEFAULT NULL,
  `meeting_link` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `hash` text DEFAULT NULL,
  `color` varchar(256) DEFAULT '#7cbae8',
  `status` varchar(512) DEFAULT '',
  `is_unavailability` tinyint(4) NOT NULL DEFAULT 0,
  `id_users_provider` int(11) DEFAULT NULL,
  `id_users_customer` int(11) DEFAULT NULL,
  `id_services` int(11) DEFAULT NULL,
  `id_google_calendar` text DEFAULT NULL,
  `id_caldav_calendar` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `id_users_provider` (`id_users_provider`),
  KEY `id_users_customer` (`id_users_customer`),
  KEY `id_services` (`id_services`),
  CONSTRAINT `appointments_services` FOREIGN KEY (`id_services`) REFERENCES `ea_services` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `appointments_users_customer` FOREIGN KEY (`id_users_customer`) REFERENCES `ea_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `appointments_users_provider` FOREIGN KEY (`id_users_provider`) REFERENCES `ea_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ea_appointments`
--

LOCK TABLES `ea_appointments` WRITE;
/*!40000 ALTER TABLE `ea_appointments` DISABLE KEYS */;
/*!40000 ALTER TABLE `ea_appointments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ea_blocked_periods`
--

DROP TABLE IF EXISTS `ea_blocked_periods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ea_blocked_periods` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `create_datetime` datetime DEFAULT NULL,
  `update_datetime` datetime DEFAULT NULL,
  `name` varchar(256) DEFAULT NULL,
  `start_datetime` datetime DEFAULT NULL,
  `end_datetime` datetime DEFAULT NULL,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ea_blocked_periods`
--

LOCK TABLES `ea_blocked_periods` WRITE;
/*!40000 ALTER TABLE `ea_blocked_periods` DISABLE KEYS */;
/*!40000 ALTER TABLE `ea_blocked_periods` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ea_consents`
--

DROP TABLE IF EXISTS `ea_consents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ea_consents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_users` int(11) DEFAULT NULL,
  `create_datetime` datetime DEFAULT NULL,
  `update_datetime` datetime DEFAULT NULL,
  `created` timestamp NULL DEFAULT NULL,
  `modified` timestamp NULL DEFAULT NULL,
  `first_name` varchar(256) DEFAULT NULL,
  `last_name` varchar(256) DEFAULT NULL,
  `email` varchar(512) DEFAULT NULL,
  `ip` varchar(256) DEFAULT NULL,
  `type` varchar(256) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `consents_users` (`id_users`),
  CONSTRAINT `consents_users` FOREIGN KEY (`id_users`) REFERENCES `ea_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ea_consents`
--

LOCK TABLES `ea_consents` WRITE;
/*!40000 ALTER TABLE `ea_consents` DISABLE KEYS */;
/*!40000 ALTER TABLE `ea_consents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ea_migrations`
--

DROP TABLE IF EXISTS `ea_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ea_migrations` (
  `version` bigint(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ea_migrations`
--

LOCK TABLES `ea_migrations` WRITE;
/*!40000 ALTER TABLE `ea_migrations` DISABLE KEYS */;
INSERT INTO `ea_migrations` VALUES
(69);
/*!40000 ALTER TABLE `ea_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ea_roles`
--

DROP TABLE IF EXISTS `ea_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ea_roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `create_datetime` datetime DEFAULT NULL,
  `update_datetime` datetime DEFAULT NULL,
  `name` varchar(256) DEFAULT NULL,
  `slug` varchar(256) DEFAULT NULL,
  `is_admin` tinyint(4) DEFAULT NULL,
  `appointments` int(11) DEFAULT NULL,
  `customers` int(11) DEFAULT NULL,
  `services` int(11) DEFAULT NULL,
  `users` int(11) DEFAULT NULL,
  `system_settings` int(11) DEFAULT NULL,
  `user_settings` int(11) DEFAULT NULL,
  `webhooks` int(11) DEFAULT NULL,
  `blocked_periods` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ea_roles`
--

LOCK TABLES `ea_roles` WRITE;
/*!40000 ALTER TABLE `ea_roles` DISABLE KEYS */;
INSERT INTO `ea_roles` VALUES
(1,NULL,NULL,'Administrator','admin',1,15,15,15,15,15,15,15,15),
(2,NULL,NULL,'Provider','provider',0,15,15,0,0,0,15,0,0),
(3,NULL,NULL,'Customer','customer',0,0,0,0,0,0,0,0,0),
(4,NULL,NULL,'Secretary','secretary',0,15,15,0,0,0,15,0,0);
/*!40000 ALTER TABLE `ea_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ea_secretaries_providers`
--

DROP TABLE IF EXISTS `ea_secretaries_providers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ea_secretaries_providers` (
  `id_users_secretary` int(11) NOT NULL,
  `id_users_provider` int(11) NOT NULL,
  PRIMARY KEY (`id_users_secretary`,`id_users_provider`),
  KEY `secretaries_users_provider` (`id_users_provider`),
  CONSTRAINT `secretaries_users_provider` FOREIGN KEY (`id_users_provider`) REFERENCES `ea_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `secretaries_users_secretary` FOREIGN KEY (`id_users_secretary`) REFERENCES `ea_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ea_secretaries_providers`
--

LOCK TABLES `ea_secretaries_providers` WRITE;
/*!40000 ALTER TABLE `ea_secretaries_providers` DISABLE KEYS */;
/*!40000 ALTER TABLE `ea_secretaries_providers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ea_service_categories`
--

DROP TABLE IF EXISTS `ea_service_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ea_service_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `create_datetime` datetime DEFAULT NULL,
  `update_datetime` datetime DEFAULT NULL,
  `name` varchar(256) DEFAULT NULL,
  `description` text DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ea_service_categories`
--

LOCK TABLES `ea_service_categories` WRITE;
/*!40000 ALTER TABLE `ea_service_categories` DISABLE KEYS */;
/*!40000 ALTER TABLE `ea_service_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ea_services`
--

DROP TABLE IF EXISTS `ea_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ea_services` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `create_datetime` datetime DEFAULT NULL,
  `update_datetime` datetime DEFAULT NULL,
  `name` varchar(256) DEFAULT NULL,
  `duration` int(11) DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `currency` varchar(32) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `slot_interval` int(11) DEFAULT 15,
  `color` varchar(256) DEFAULT '#7cbae8',
  `location` text DEFAULT NULL,
  `attendants_number` int(11) DEFAULT 1,
  `is_private` tinyint(4) DEFAULT 0,
  `id_service_categories` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `id_service_categories` (`id_service_categories`),
  CONSTRAINT `services_service_categories` FOREIGN KEY (`id_service_categories`) REFERENCES `ea_service_categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ea_services`
--

LOCK TABLES `ea_services` WRITE;
/*!40000 ALTER TABLE `ea_services` DISABLE KEYS */;
INSERT INTO `ea_services` VALUES
(1,'2026-10-03 14:21:34','2026-10-03 14:21:34','Service',30,0.00,'',NULL,15,'#7cbae8',NULL,1,0,NULL),
(2,NULL,NULL,'Fixture Alternate',45,12.50,'SAR',NULL,15,'#7cbae8',NULL,1,0,NULL);
/*!40000 ALTER TABLE `ea_services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ea_services_providers`
--

DROP TABLE IF EXISTS `ea_services_providers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ea_services_providers` (
  `id_users` int(11) NOT NULL,
  `id_services` int(11) NOT NULL,
  PRIMARY KEY (`id_users`,`id_services`),
  KEY `services_providers_services` (`id_services`),
  CONSTRAINT `services_providers_services` FOREIGN KEY (`id_services`) REFERENCES `ea_services` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `services_providers_users_provider` FOREIGN KEY (`id_users`) REFERENCES `ea_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ea_services_providers`
--

LOCK TABLES `ea_services_providers` WRITE;
/*!40000 ALTER TABLE `ea_services_providers` DISABLE KEYS */;
INSERT INTO `ea_services_providers` VALUES
(2,1),
(2,2);
/*!40000 ALTER TABLE `ea_services_providers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ea_settings`
--

DROP TABLE IF EXISTS `ea_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ea_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `create_datetime` datetime DEFAULT NULL,
  `update_datetime` datetime DEFAULT NULL,
  `name` varchar(512) DEFAULT NULL,
  `value` longtext DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=82 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ea_settings`
--

LOCK TABLES `ea_settings` WRITE;
/*!40000 ALTER TABLE `ea_settings` DISABLE KEYS */;
INSERT INTO `ea_settings` VALUES
(1,NULL,NULL,'company_working_plan','{\"monday\":{\"start\":\"09:00\",\"end\":\"18:00\",\"breaks\":[{\"start\":\"14:30\",\"end\":\"15:00\"}]},\"tuesday\":{\"start\":\"09:00\",\"end\":\"18:00\",\"breaks\":[{\"start\":\"14:30\",\"end\":\"15:00\"}]},\"wednesday\":{\"start\":\"09:00\",\"end\":\"18:00\",\"breaks\":[{\"start\":\"14:30\",\"end\":\"15:00\"}]},\"thursday\":{\"start\":\"09:00\",\"end\":\"18:00\",\"breaks\":[{\"start\":\"14:30\",\"end\":\"15:00\"}]},\"friday\":{\"start\":\"09:00\",\"end\":\"18:00\",\"breaks\":[{\"start\":\"14:30\",\"end\":\"15:00\"}]},\"saturday\":{\"start\":\"09:00\",\"end\":\"18:00\",\"breaks\":[{\"start\":\"14:30\",\"end\":\"15:00\"}]},\"sunday\":{\"start\":\"09:00\",\"end\":\"18:00\",\"breaks\":[{\"start\":\"14:30\",\"end\":\"15:00\"}]}}'),
(2,NULL,NULL,'book_advance_timeout','30'),
(3,NULL,NULL,'google_analytics_code',''),
(4,NULL,NULL,'customer_notifications','0'),
(5,NULL,NULL,'date_format','DMY'),
(6,NULL,NULL,'require_captcha','0'),
(7,NULL,NULL,'time_format','regular'),
(8,NULL,NULL,'display_cookie_notice','0'),
(9,NULL,NULL,'cookie_notice_content','Cookie notice content.'),
(10,NULL,NULL,'display_terms_and_conditions','0'),
(11,NULL,NULL,'terms_and_conditions_content','Terms and conditions content.'),
(12,NULL,NULL,'display_privacy_policy','0'),
(13,NULL,NULL,'privacy_policy_content','Privacy policy content.'),
(14,NULL,NULL,'first_weekday','sunday'),
(16,NULL,NULL,'api_token',''),
(17,NULL,NULL,'display_any_provider','1'),
(18,NULL,NULL,'display_first_name','1'),
(19,NULL,NULL,'require_first_name','1'),
(20,NULL,NULL,'display_last_name','1'),
(21,NULL,NULL,'require_last_name','1'),
(22,NULL,NULL,'display_email','1'),
(23,NULL,NULL,'require_email','1'),
(24,NULL,NULL,'display_phone_number','1'),
(25,NULL,NULL,'require_phone_number','1'),
(26,NULL,NULL,'display_address','1'),
(27,NULL,NULL,'require_address','0'),
(28,NULL,NULL,'display_city','1'),
(29,NULL,NULL,'require_city','0'),
(30,NULL,NULL,'display_zip_code','1'),
(31,NULL,NULL,'require_zip_code','0'),
(32,NULL,NULL,'display_notes','1'),
(33,NULL,NULL,'require_notes','0'),
(34,NULL,NULL,'matomo_analytics_url',''),
(35,NULL,NULL,'display_delete_personal_information','0'),
(36,NULL,NULL,'disable_booking','0'),
(37,NULL,NULL,'disable_booking_message','<p style=\"text-align: center;\">Thanks for stopping by!</p><p style=\"text-align: center;\">We are not accepting new appointments at the moment, please check back again later.</p>'),
(38,NULL,NULL,'company_logo',''),
(39,NULL,NULL,'company_color','#ffffff'),
(40,NULL,NULL,'display_login_button','1'),
(41,NULL,NULL,'theme','default'),
(42,'2026-10-03 14:21:33','2026-10-03 14:21:33','limit_customer_access','0'),
(43,NULL,NULL,'future_booking_limit','90'),
(44,NULL,NULL,'appointment_status_options','[\"Booked\", \"Confirmed\", \"Rescheduled\", \"Cancelled\", \"Draft\"]'),
(45,NULL,NULL,'display_custom_field_1','0'),
(46,NULL,NULL,'require_custom_field_1','0'),
(47,NULL,NULL,'label_custom_field_1',''),
(48,NULL,NULL,'display_custom_field_2','0'),
(49,NULL,NULL,'require_custom_field_2','0'),
(50,NULL,NULL,'label_custom_field_2',''),
(51,NULL,NULL,'display_custom_field_3','0'),
(52,NULL,NULL,'require_custom_field_3','0'),
(53,NULL,NULL,'label_custom_field_3',''),
(54,NULL,NULL,'display_custom_field_4','0'),
(55,NULL,NULL,'require_custom_field_4','0'),
(56,NULL,NULL,'label_custom_field_4',''),
(57,NULL,NULL,'display_custom_field_5','0'),
(58,NULL,NULL,'require_custom_field_5','0'),
(59,NULL,NULL,'label_custom_field_5',''),
(60,NULL,NULL,'matomo_analytics_site_id','1'),
(61,NULL,NULL,'default_language','english'),
(62,NULL,NULL,'default_timezone','Asia/Riyadh'),
(63,'2026-10-03 14:21:34','2026-10-03 14:21:34','ldap_is_active','0'),
(64,'2026-10-03 14:21:34','2026-10-03 14:21:34','ldap_host',''),
(65,'2026-10-03 14:21:34','2026-10-03 14:21:34','ldap_port',''),
(66,'2026-10-03 14:21:34','2026-10-03 14:21:34','ldap_user_dn',''),
(67,'2026-10-03 14:21:34','2026-10-03 14:21:34','ldap_password',''),
(68,'2026-10-03 14:21:34','2026-10-03 14:21:34','ldap_base_dn',''),
(69,'2026-10-03 14:21:34','2026-10-03 14:21:34','ldap_filter','(&(objectClass=*)(|(cn={{KEYWORD}})(sn={{KEYWORD}})(mail={{KEYWORD}})(givenName={{KEYWORD}})(uid={{KEYWORD}})))'),
(70,'2026-10-03 14:21:34','2026-10-03 14:21:34','ldap_field_mapping','{\n    \"first_name\": \"givenname\",\n    \"last_name\": \"sn\",\n    \"email\": \"mail\",\n    \"phone_number\": \"telephonenumber\",\n    \"username\": \"cn\"\n}'),
(71,NULL,NULL,'google_sync_feature','0'),
(72,NULL,NULL,'google_client_id',''),
(73,NULL,NULL,'google_client_secret',''),
(74,NULL,NULL,'data_retention_days','0'),
(75,NULL,NULL,'altcha_enabled','0'),
(76,NULL,NULL,'altcha_hmac_key',''),
(77,NULL,NULL,'altcha_max_number','100000'),
(78,NULL,NULL,'altcha_expires','300'),
(79,'2026-10-03 14:21:34','2026-10-03 14:21:34','company_name','AccessFinish Synthetic Booking'),
(80,'2026-10-03 14:21:34','2026-10-03 14:21:34','company_email','company@example.invalid'),
(81,'2026-10-03 14:21:34','2026-10-03 14:21:34','company_link','http://127.0.0.1:8080');
/*!40000 ALTER TABLE `ea_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ea_user_settings`
--

DROP TABLE IF EXISTS `ea_user_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ea_user_settings` (
  `id_users` int(11) NOT NULL,
  `username` varchar(256) DEFAULT NULL,
  `password` varchar(512) DEFAULT NULL,
  `password_reset_token` varchar(64) DEFAULT NULL,
  `password_reset_expires` datetime DEFAULT NULL,
  `salt` varchar(512) DEFAULT NULL,
  `working_plan` text DEFAULT NULL,
  `working_plan_exceptions` text DEFAULT NULL,
  `notifications` tinyint(4) DEFAULT NULL,
  `google_sync` tinyint(4) DEFAULT NULL,
  `google_token` text DEFAULT NULL,
  `google_calendar` varchar(128) DEFAULT NULL,
  `caldav_sync` tinyint(4) DEFAULT 0,
  `caldav_url` varchar(512) DEFAULT NULL,
  `caldav_username` varchar(256) DEFAULT NULL,
  `caldav_password` varchar(256) DEFAULT NULL,
  `sync_past_days` int(11) DEFAULT 30,
  `sync_future_days` int(11) DEFAULT 90,
  `calendar_view` varchar(32) DEFAULT 'default',
  PRIMARY KEY (`id_users`),
  CONSTRAINT `user_settings_users` FOREIGN KEY (`id_users`) REFERENCES `ea_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ea_user_settings`
--

LOCK TABLES `ea_user_settings` WRITE;
/*!40000 ALTER TABLE `ea_user_settings` DISABLE KEYS */;
INSERT INTO `ea_user_settings` VALUES
(1,'gateadmin','!disabled-fixture-login!',NULL,NULL,'disabled-fixture-salt',NULL,NULL,0,NULL,NULL,NULL,0,NULL,NULL,NULL,30,90,'default'),
(2,'janedoe','!disabled-fixture-login!',NULL,NULL,'disabled-fixture-salt','{\"monday\":{\"start\":\"09:00\",\"end\":\"18:00\",\"breaks\":[{\"start\":\"14:30\",\"end\":\"15:00\"}]},\"tuesday\":{\"start\":\"09:00\",\"end\":\"18:00\",\"breaks\":[{\"start\":\"14:30\",\"end\":\"15:00\"}]},\"wednesday\":{\"start\":\"09:00\",\"end\":\"18:00\",\"breaks\":[{\"start\":\"14:30\",\"end\":\"15:00\"}]},\"thursday\":{\"start\":\"09:00\",\"end\":\"18:00\",\"breaks\":[{\"start\":\"14:30\",\"end\":\"15:00\"}]},\"friday\":{\"start\":\"09:00\",\"end\":\"18:00\",\"breaks\":[{\"start\":\"14:30\",\"end\":\"15:00\"}]},\"saturday\":{\"start\":\"09:00\",\"end\":\"18:00\",\"breaks\":[{\"start\":\"14:30\",\"end\":\"15:00\"}]},\"sunday\":{\"start\":\"09:00\",\"end\":\"18:00\",\"breaks\":[{\"start\":\"14:30\",\"end\":\"15:00\"}]}}',NULL,0,0,NULL,NULL,0,NULL,NULL,NULL,30,90,'default');
/*!40000 ALTER TABLE `ea_user_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ea_users`
--

DROP TABLE IF EXISTS `ea_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ea_users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `create_datetime` datetime DEFAULT NULL,
  `update_datetime` datetime DEFAULT NULL,
  `first_name` varchar(256) DEFAULT NULL,
  `last_name` varchar(512) DEFAULT NULL,
  `email` varchar(512) DEFAULT NULL,
  `mobile_number` varchar(128) DEFAULT NULL,
  `phone_number` varchar(128) DEFAULT NULL,
  `address` varchar(256) DEFAULT NULL,
  `city` varchar(256) DEFAULT NULL,
  `state` varchar(128) DEFAULT NULL,
  `zip_code` varchar(64) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `timezone` varchar(256) DEFAULT 'UTC',
  `language` varchar(256) DEFAULT 'english',
  `custom_field_1` text DEFAULT NULL,
  `custom_field_2` text DEFAULT NULL,
  `custom_field_3` text DEFAULT NULL,
  `custom_field_4` text DEFAULT NULL,
  `custom_field_5` text DEFAULT NULL,
  `is_private` tinyint(4) DEFAULT 0,
  `ldap_dn` text DEFAULT NULL,
  `id_roles` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `id_roles` (`id_roles`),
  CONSTRAINT `users_roles` FOREIGN KEY (`id_roles`) REFERENCES `ea_roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ea_users`
--

LOCK TABLES `ea_users` WRITE;
/*!40000 ALTER TABLE `ea_users` DISABLE KEYS */;
INSERT INTO `ea_users` VALUES
(1,'2026-10-03 14:21:34','2026-10-03 14:21:34','Synthetic','QA','admin@example.invalid',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Asia/Riyadh','english',NULL,NULL,NULL,NULL,NULL,0,NULL,1),
(2,'2026-10-03 14:21:34','2026-10-03 14:21:34','Jane','Doe','provider@example.invalid',NULL,'+1 (000) 000-0000',NULL,NULL,NULL,NULL,NULL,'Asia/Riyadh','english',NULL,NULL,NULL,NULL,NULL,0,NULL,2),
(3,'2026-10-03 14:21:34','2026-10-03 14:21:34','James','Doe','existing-customer@example.invalid',NULL,'+1 (000) 000-0000',NULL,NULL,NULL,NULL,NULL,'Asia/Riyadh','english',NULL,NULL,NULL,NULL,NULL,0,NULL,3);
/*!40000 ALTER TABLE `ea_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ea_webhooks`
--

DROP TABLE IF EXISTS `ea_webhooks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ea_webhooks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `create_datetime` datetime DEFAULT NULL,
  `update_datetime` datetime DEFAULT NULL,
  `name` varchar(256) DEFAULT NULL,
  `url` text DEFAULT NULL,
  `actions` text DEFAULT NULL,
  `secret_header` varchar(256) DEFAULT 'X-Ea-Token',
  `secret_token` varchar(512) DEFAULT NULL,
  `is_ssl_verified` tinyint(4) NOT NULL DEFAULT 1,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ea_webhooks`
--

LOCK TABLES `ea_webhooks` WRITE;
/*!40000 ALTER TABLE `ea_webhooks` DISABLE KEYS */;
/*!40000 ALTER TABLE `ea_webhooks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ea_working_plan_exceptions`
--

DROP TABLE IF EXISTS `ea_working_plan_exceptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ea_working_plan_exceptions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `breaks` text DEFAULT NULL,
  `id_users_provider` int(11) NOT NULL,
  `create_datetime` datetime DEFAULT NULL,
  `update_datetime` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `start_date` (`start_date`),
  KEY `end_date` (`end_date`),
  KEY `id_users_provider` (`id_users_provider`),
  CONSTRAINT `working_plan_exceptions_users_provider` FOREIGN KEY (`id_users_provider`) REFERENCES `ea_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ea_working_plan_exceptions`
--

LOCK TABLES `ea_working_plan_exceptions` WRITE;
/*!40000 ALTER TABLE `ea_working_plan_exceptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `ea_working_plan_exceptions` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed on 2026-10-03 14:25:25
