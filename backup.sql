-- MySQL dump 10.13  Distrib 8.0.44, for Linux (x86_64)
--
-- Host: localhost    Database: database_kassa
-- ------------------------------------------------------
-- Server version	8.0.44-0ubuntu0.24.04.2

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `family_assignation`
--

DROP TABLE IF EXISTS `family_assignation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `family_assignation` (
  `id` int NOT NULL,
  `users_assigned_id` int NOT NULL,
  `users_responsable_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_family_assignation_users1_idx` (`users_assigned_id`),
  KEY `fk_family_assignation_users2_idx` (`users_responsable_id`),
  CONSTRAINT `fk_family_assignation_users1` FOREIGN KEY (`users_assigned_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_family_assignation_users2` FOREIGN KEY (`users_responsable_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `family_assignation`
--

LOCK TABLES `family_assignation` WRITE;
/*!40000 ALTER TABLE `family_assignation` DISABLE KEYS */;
INSERT INTO `family_assignation` VALUES (1,8,9),(3,33,9),(4,34,9),(5,35,9),(6,40,9),(7,39,9),(14,11,44),(15,10,44),(16,17,44),(17,28,44),(18,44,44),(19,43,44),(20,11,11),(21,10,11),(22,17,11),(23,28,11),(24,44,11),(25,43,11),(26,9,9),(27,12,12),(28,18,12),(29,23,12),(30,13,13),(31,19,13),(32,24,13),(33,14,14),(34,20,14),(35,25,14),(36,15,15),(37,21,15),(38,26,15),(39,22,16),(40,27,16),(41,16,16),(42,31,31),(43,30,31),(44,32,31),(45,29,36),(46,36,36),(47,37,36),(48,45,2),(49,46,15),(50,47,11),(51,47,44),(52,48,14),(54,50,13),(55,51,9),(56,52,9),(57,53,9),(58,54,9),(59,55,13),(60,56,13),(61,57,14),(64,59,15),(65,59,46),(66,58,36);
/*!40000 ALTER TABLE `family_assignation` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `messages`
--

DROP TABLE IF EXISTS `messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `message` varchar(225) DEFAULT NULL,
  `message_type` enum('APPROVAL','MESSAGE','EXTERNE') DEFAULT NULL,
  `received_at` datetime NOT NULL,
  `link` varchar(150) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=85 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `messages`
--

LOCK TABLES `messages` WRITE;
/*!40000 ALTER TABLE `messages` DISABLE KEYS */;
INSERT INTO `messages` VALUES (48,'Mamadou Taslima Diallo vous a soumis une transaction à valider','MESSAGE','2026-01-22 15:36:23','/approvals'),(52,'Bonjour j\'ai besoin d\'aide. L\'interface graphique à un problème.','MESSAGE','2026-01-24 06:40:29',NULL),(53,'Merci mon gars','MESSAGE','2026-01-24 06:43:24',NULL),(54,'Bonjour mon amis','MESSAGE','2026-01-24 07:07:30',NULL),(55,'Tu es une amie, je t\'aime bien','MESSAGE','2026-01-24 07:09:39',NULL),(56,'Cette personne est mauvaise, je l\'aime pas','MESSAGE','2026-01-24 07:28:08',NULL),(58,'Mamadou Taslima Diallo vous a soumis une transaction à valider','MESSAGE','2026-01-25 14:21:57','/approvals'),(63,'treasury treasury vous a soumis une transaction à valider','MESSAGE','2026-01-25 14:38:57','/approvals'),(67,'Kadiatou Barry vous a soumis une transaction à valider','MESSAGE','2026-01-25 14:43:15','/approvals'),(69,'Kadiatou Barry vous a soumis une transaction à valider','MESSAGE','2026-01-25 14:49:15','/approvals'),(70,'Kadiatou Barry vous a soumis une transaction à valider','MESSAGE','2026-01-25 14:50:30','/approvals'),(71,'Kadiatou Barry vous a soumis une transaction à valider','MESSAGE','2026-01-25 14:52:27','/approvals'),(80,'Kadiatou Barry vous a soumis une transaction à valider','MESSAGE','2026-01-25 14:53:57','/approvals'),(81,'Kadiatou Barry vous a soumis une transaction à valider','MESSAGE','2026-01-25 15:00:14','/approvals');
/*!40000 ALTER TABLE `messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `messages_recipients`
--

DROP TABLE IF EXISTS `messages_recipients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages_recipients` (
  `id` int NOT NULL,
  `isreaded` tinyint NOT NULL,
  `sender_id` int NOT NULL,
  `receiver_id` int NOT NULL,
  `messages_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_messages_recipients_users1_idx` (`sender_id`),
  KEY `fk_messages_recipients_users2_idx` (`receiver_id`),
  KEY `fk_messages_recipients_messages1_idx` (`messages_id`),
  CONSTRAINT `fk_messages_recipients_messages1` FOREIGN KEY (`messages_id`) REFERENCES `messages` (`id`),
  CONSTRAINT `fk_messages_recipients_users1` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_messages_recipients_users2` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `messages_recipients`
--

LOCK TABLES `messages_recipients` WRITE;
/*!40000 ALTER TABLE `messages_recipients` DISABLE KEYS */;
INSERT INTO `messages_recipients` VALUES (1,0,9,40,48),(2,1,9,41,48),(3,1,9,12,48),(4,0,9,45,48),(5,1,9,13,48),(6,1,9,2,52),(7,1,9,2,53),(8,1,9,2,54),(9,1,9,2,55),(10,1,9,2,56);
/*!40000 ALTER TABLE `messages_recipients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_methods`
--

DROP TABLE IF EXISTS `payment_methods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_methods` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(45) NOT NULL,
  `isactive` tinyint NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `type_of_proof` enum('TRANSACTIONNUMBER','LINK','BOTH') NOT NULL DEFAULT 'BOTH',
  `account_number` varchar(45) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `updated_at_UNIQUE` (`updated_at`),
  UNIQUE KEY `created_at_UNIQUE` (`created_at`),
  UNIQUE KEY `name_UNIQUE` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_methods`
--

LOCK TABLES `payment_methods` WRITE;
/*!40000 ALTER TABLE `payment_methods` DISABLE KEYS */;
INSERT INTO `payment_methods` VALUES (1,'Orange money',1,'2026-01-16 23:46:46','2026-01-24 10:43:31','BOTH','612564382'),(2,'Argent compte',1,'2026-01-16 23:50:32','2026-01-24 10:45:23','BOTH','Reçu'),(3,'Virement bancaire',1,'2026-01-16 23:50:38','2026-01-24 10:45:44','BOTH','Sans numéro');
/*!40000 ALTER TABLE `payment_methods` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `revoked_tokens`
--

DROP TABLE IF EXISTS `revoked_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `revoked_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `jti` varchar(36) DEFAULT NULL,
  `token` text,
  `expires` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_jti` (`jti`)
) ENGINE=InnoDB AUTO_INCREMENT=72 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `revoked_tokens`
--

LOCK TABLES `revoked_tokens` WRITE;
/*!40000 ALTER TABLE `revoked_tokens` DISABLE KEYS */;
INSERT INTO `revoked_tokens` VALUES (1,'3d13924e-33d5-40d9-96f3-691f45f08fdf',NULL,'2026-01-12 11:56:39'),(2,'d382dffa-9e53-46cd-b133-88eb68d92b42',NULL,'2026-01-12 16:55:45'),(3,'b101393d-6838-472d-aa5a-63ef066a8b2e',NULL,'2026-01-12 16:16:30'),(4,'dd1a8cd3-8299-4022-b155-03f67b802b4d',NULL,'2026-01-12 17:07:23'),(5,'5d9252e7-9112-4ad4-aebc-f679e79984d4',NULL,'2026-01-12 17:24:00'),(6,'c379ade1-0712-46ae-bafa-37a6dece9d03',NULL,'2026-01-12 17:42:14'),(7,'3d742734-c083-40a5-a704-feec1db85eaa',NULL,'2026-01-12 18:01:20'),(8,'a9ade272-bd88-49b9-94d9-9a95ab938117',NULL,'2026-01-12 17:56:07'),(9,'7d8799d1-d7ac-4f8b-a2af-dfe8b0096547',NULL,'2026-01-13 07:11:47'),(10,'0a155754-2963-4e15-894a-36aa37f84a04',NULL,'2026-01-13 12:07:08'),(11,'df027bf6-36a1-4949-905f-27265a0b91d4',NULL,'2026-01-13 19:55:47'),(12,'0de55802-ef97-4a26-894f-49da2249730a',NULL,'2026-01-13 20:59:47'),(13,'0035ae38-4f1f-467c-a11f-a0a465f52997',NULL,'2026-01-14 09:05:22'),(14,'7cf5b527-2e17-4992-9002-91de360744d6',NULL,'2026-01-15 07:21:30'),(15,'c6f67296-37f4-48d0-8cfb-b355a6d83eb5',NULL,'2026-01-15 09:27:57'),(16,'e4870fbd-5889-4607-9bb1-f460dfb0cf14',NULL,'2026-01-17 02:49:47'),(17,'773b8fd4-39f4-4c6c-8619-76c4c06913d8',NULL,'2026-01-17 04:43:38'),(18,'35d34222-d486-461d-b8c9-363b0baebb67',NULL,'2026-01-17 08:16:51'),(19,'8fb8b59e-6d4d-41dd-916f-ea5a0a82d96a',NULL,'2026-01-17 08:05:22'),(20,'e5d797d7-b12b-41ae-bb0d-920ec6901b22',NULL,'2026-01-17 12:11:56'),(21,'0bc27a96-1e23-4f41-97fe-f113c8519b1a',NULL,'2026-01-18 02:38:09'),(22,'1a113c9d-4c83-40f8-91e5-28969881bc24',NULL,'2026-01-18 02:42:26'),(23,'54a4d2b2-5327-4fb0-ad58-71717e652e3e',NULL,'2026-01-18 02:52:04'),(24,'b51660b7-4311-4bb7-a318-2b95c8e63c72',NULL,'2026-01-18 02:53:30'),(25,'1ff21147-7ab3-4900-a0e0-c973b5ceaafe',NULL,'2026-01-19 13:20:34'),(26,'e715e2d6-10f8-4aa0-ac0b-ae1f8ea59223',NULL,'2026-01-19 18:24:08'),(27,'a98188ad-6a1a-4799-963e-27d7b1df4ea5',NULL,'2026-01-21 08:09:30'),(28,'a1b7308a-4122-4f43-8cd1-98f3443f16b7',NULL,'2026-01-21 08:12:48'),(29,'cf12391f-f08b-4b2c-9f7a-824a27470bd5',NULL,'2026-01-21 11:13:43'),(30,'d1f713ac-faf4-4bc4-a6e0-fb0e406dcbb0',NULL,'2026-01-21 13:37:53'),(31,'eb288aef-9e6d-4293-a925-c637f1ca83f8',NULL,'2026-01-21 13:50:27'),(32,'471b2af0-fe9e-4994-8b52-fe0d63dbc45e',NULL,'2026-01-21 14:27:44'),(33,'d97255c3-d35a-4cfe-9727-130bd4e21c09',NULL,'2026-01-21 14:30:13'),(34,'670581b6-d3d4-4dc1-938b-9ae7c7248de5',NULL,'2026-01-21 14:30:29'),(35,'0738eaf9-26c9-4b9f-a690-38a68d14a0c9',NULL,'2026-01-21 14:25:18'),(36,'9e9780f6-440c-405f-ac03-8871f9074cf6',NULL,'2026-01-21 14:40:52'),(37,'247937bc-92eb-44fa-a05f-a5807428a323',NULL,'2026-01-21 15:15:32'),(38,'1e6878e4-073f-40cf-bec8-48cebb2bcb8a',NULL,'2026-01-21 20:26:37'),(39,'354403c5-fd52-4cbc-9ccf-59a541cf8eee',NULL,'2026-01-21 22:02:45'),(40,'63f62cb5-d660-4a18-8d3a-d98a3f465b90',NULL,'2026-01-21 22:23:50'),(41,'faeec400-a4c3-41e5-adf3-894b7913162b',NULL,'2026-01-21 22:28:15'),(42,'710944c4-a4be-4750-9ba7-84dff89e719b',NULL,'2026-01-21 22:29:53'),(43,'c1544514-0cbe-4ac8-9838-4d38ead41b7b',NULL,'2026-01-21 22:06:19'),(44,'50a1eb1d-d955-4696-8d16-8bc042fa669d',NULL,'2026-01-21 22:33:30'),(45,'2b5ddf9b-83ae-44f1-8068-3c35964f6d3e',NULL,'2026-01-21 22:58:56'),(46,'dfc615a9-c071-4abd-80e7-a9b33a742cfa',NULL,'2026-01-22 05:49:53'),(47,'e01aa989-cb4b-4506-b7a5-3f9e90ee3ebb',NULL,'2026-01-22 05:53:40'),(48,'076ab58a-fc53-47b0-9295-e8425ef6f9be',NULL,'2026-01-22 07:43:46'),(49,'05064df3-35aa-4b80-a3f5-321fbc3aeccc',NULL,'2026-01-22 10:11:09'),(50,'9c97d433-e28a-476c-b7a1-2e60b7ae7e98',NULL,'2026-01-22 13:17:16'),(51,'16b22f0b-a626-49fa-9f53-998dc785bbc0',NULL,'2026-01-22 13:17:40'),(52,'b3dd27be-7e66-4f35-aad9-0be6dc545dd9',NULL,'2026-01-22 13:17:56'),(53,'0ffd11b4-4bbb-49a6-98d3-90115d3a1a63',NULL,'2026-01-22 13:27:19'),(54,'332c3680-d2fb-46d3-a21f-f81734f4cb42',NULL,'2026-01-22 13:29:46'),(55,'7ba0d90c-a2e0-4a2f-b358-dc1354952f6e',NULL,'2026-01-22 13:30:15'),(56,'859bcf75-10f1-4322-b7e5-e74afa47aad9',NULL,'2026-01-22 14:32:03'),(57,'a6e1d80b-f110-4e66-82dd-5c33ed5f1ffa',NULL,'2026-01-22 15:15:43'),(58,'a01e8b14-4c47-4c7e-bb46-8cd42a5a9015',NULL,'2026-01-22 15:22:00'),(59,'ae36cd58-009a-4373-97f4-9a6cb028bed7',NULL,'2026-01-22 15:23:11'),(60,'6d7f07c9-000a-4879-a42d-735a5e78b89f',NULL,'2026-01-22 15:45:20'),(61,'d09ccd40-7906-4e8b-85a2-25d2e785eaa7',NULL,'2026-01-22 16:19:52'),(62,'a934b170-aeb8-407e-843f-5072e73bcc4b',NULL,'2026-01-22 16:35:24'),(63,'3c9c525f-09ec-41ee-9d5f-3efc98c36d2a',NULL,'2026-01-22 16:36:56'),(64,'6d943de4-22d8-46a3-b2ff-a43ffdbc694f',NULL,'2026-01-22 16:38:09'),(65,'3df3f988-bcf4-4e8c-acbe-e3cd679a8067',NULL,'2026-01-22 16:39:31'),(66,'8da0cd69-9f3e-4ac7-a683-030c10462766',NULL,'2026-01-23 03:37:28'),(67,'8bb0c75e-b7e0-42ce-8fc7-e669e27524e7',NULL,'2026-01-23 08:49:04'),(68,'0134cc1b-381c-4819-bf18-fa23d8baefd5',NULL,'2026-01-23 11:18:26'),(69,'8f40d9af-5d83-48f9-a0c7-18cf55a8ce5e',NULL,'2026-01-25 15:16:14'),(70,'67fb5ed1-edd2-47ab-b54c-e470cc5df61d',NULL,'2026-01-25 15:11:35'),(71,'da8aa59d-44ae-47e5-8b64-66660ddcdd38',NULL,'2026-01-25 21:01:49');
/*!40000 ALTER TABLE `revoked_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_attribution`
--

DROP TABLE IF EXISTS `role_attribution`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_attribution` (
  `id` int NOT NULL AUTO_INCREMENT,
  `users_id` int NOT NULL,
  `roles_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_role_attribution_users1_idx` (`users_id`),
  KEY `fk_role_attribution_roles1_idx` (`roles_id`),
  CONSTRAINT `fk_role_attribution_roles1` FOREIGN KEY (`roles_id`) REFERENCES `roles` (`id`),
  CONSTRAINT `fk_role_attribution_users1` FOREIGN KEY (`users_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=126 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_attribution`
--

LOCK TABLES `role_attribution` WRITE;
/*!40000 ALTER TABLE `role_attribution` DISABLE KEYS */;
INSERT INTO `role_attribution` VALUES (1,2,1),(2,2,2),(3,2,3),(4,1,4),(5,3,4),(6,4,4),(7,5,3),(8,6,4),(9,2,5),(11,7,2),(12,8,4),(15,9,2),(16,9,5),(17,10,4),(18,24,4),(19,23,4),(20,25,4),(21,26,4),(22,21,4),(23,27,4),(25,28,4),(26,15,5),(27,15,2),(28,13,5),(29,13,2),(30,29,4),(31,16,5),(32,16,2),(33,19,4),(34,20,4),(35,22,4),(36,18,4),(37,17,4),(38,12,2),(39,12,5),(40,11,5),(41,11,2),(42,14,5),(43,14,2),(44,30,4),(45,31,2),(46,31,5),(49,32,4),(50,33,4),(51,34,2),(52,35,4),(53,11,6),(54,15,6),(55,9,6),(56,13,6),(58,12,6),(59,16,6),(60,14,6),(61,31,6),(62,34,6),(64,1,6),(66,12,7),(67,13,7),(68,36,2),(69,36,6),(70,36,5),(71,37,4),(73,39,4),(75,40,7),(76,40,6),(77,40,2),(78,7,6),(79,41,7),(80,41,2),(81,41,6),(82,42,6),(83,42,2),(84,42,8),(85,4,2),(86,3,2),(87,43,8),(88,43,6),(89,43,2),(90,44,2),(91,44,5),(92,44,6),(93,45,7),(94,45,6),(95,45,2),(96,46,2),(97,46,6),(98,48,2),(99,46,5),(101,50,2),(102,50,6),(103,51,6),(105,51,2),(106,53,6),(108,53,2),(109,54,6),(110,54,2),(115,55,6),(116,55,2),(117,56,6),(118,56,2),(119,8,2),(120,33,2),(121,57,2),(122,58,6),(123,58,2),(124,59,6),(125,59,2);
/*!40000 ALTER TABLE `role_attribution` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int NOT NULL,
  `role` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'admin'),(2,'user'),(3,'guest'),(4,'norole'),(5,'admingroup'),(6,'member'),(7,'treasury'),(8,'board');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transaction_approvals`
--

DROP TABLE IF EXISTS `transaction_approvals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transaction_approvals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_at_approval` varchar(45) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `note` text,
  `transactions_id` int NOT NULL,
  `users_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_transaction_approvals_transactions1_idx` (`transactions_id`),
  KEY `fk_transaction_approvals_users1_idx` (`users_id`),
  CONSTRAINT `fk_transaction_approvals_transactions1` FOREIGN KEY (`transactions_id`) REFERENCES `transactions` (`id`),
  CONSTRAINT `fk_transaction_approvals_users1` FOREIGN KEY (`users_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transaction_approvals`
--

LOCK TABLES `transaction_approvals` WRITE;
/*!40000 ALTER TABLE `transaction_approvals` DISABLE KEYS */;
INSERT INTO `transaction_approvals` VALUES (26,'treasury','2026-01-22 20:27:05',NULL,33,13),(27,'treasury','2026-01-25 14:21:36',NULL,33,12),(28,'treasury','2026-01-25 14:22:58',NULL,34,13),(29,'treasury','2026-01-25 14:25:12',NULL,34,12),(31,'treasury','2026-01-25 14:43:15','Auto-approval on submission',42,13),(32,'treasury','2026-01-25 14:49:15','Auto-approval on submission',44,13),(33,'treasury','2026-01-25 14:50:30','Auto-approval on submission',45,13),(34,'treasury','2026-01-25 14:52:27','Auto-approval on submission',46,13),(35,'treasury','2026-01-25 14:52:55',NULL,44,12),(36,'treasury','2026-01-25 14:53:18',NULL,46,12),(37,'treasury','2026-01-25 14:53:21',NULL,42,12),(38,'treasury','2026-01-25 14:53:29',NULL,45,12),(39,'treasury','2026-01-25 14:53:57','Auto-approval on submission',47,13),(40,'treasury','2026-01-25 15:00:14','Auto-approval on submission',48,13),(41,'treasury','2026-01-25 15:02:21',NULL,48,12),(42,'treasury','2026-01-25 15:02:26',NULL,47,12);
/*!40000 ALTER TABLE `transaction_approvals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transactions`
--

DROP TABLE IF EXISTS `transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `amount` decimal(10,0) NOT NULL,
  `status` enum('SAVED','PENDING','PARTIALLY_APPROVED','VALIDATED','REJECTED') NOT NULL,
  `proof_reference` varchar(255) NOT NULL,
  `validated_at` datetime NOT NULL,
  `created_at` datetime NOT NULL,
  `recorded_by_id` int NOT NULL,
  `users_id` int NOT NULL,
  `updated_by` int NOT NULL,
  `payment_methods_id` int NOT NULL,
  `transaction_type` enum('CONTRIBUTION','DONATIONS','EXPENSE') NOT NULL,
  `updated_at` datetime NOT NULL,
  `issubmitted` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `fk_transactions_users1_idx` (`recorded_by_id`),
  KEY `fk_transactions_users2_idx` (`users_id`),
  KEY `fk_transactions_users3_idx` (`updated_by`),
  KEY `fk_transactions_payment_methods1_idx` (`payment_methods_id`),
  CONSTRAINT `fk_transactions_payment_methods1` FOREIGN KEY (`payment_methods_id`) REFERENCES `payment_methods` (`id`),
  CONSTRAINT `fk_transactions_users1` FOREIGN KEY (`recorded_by_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_transactions_users2` FOREIGN KEY (`users_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_transactions_users3` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transactions`
--

LOCK TABLES `transactions` WRITE;
/*!40000 ALTER TABLE `transactions` DISABLE KEYS */;
INSERT INTO `transactions` VALUES (33,200000,'VALIDATED','https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/transactions/transaction_1.jpg','2026-01-25 14:21:36','2026-01-22 15:36:11',9,9,12,1,'CONTRIBUTION','2026-01-25 14:21:36',1),(34,510000,'VALIDATED','https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/transactions/transaction_34.jpeg','2026-01-25 14:25:12','2026-01-25 14:21:57',9,34,12,1,'CONTRIBUTION','2026-01-25 14:25:12',1),(42,50000,'VALIDATED','CI260112.1717.B92348','2026-01-25 14:53:21','2026-01-25 14:42:48',13,36,12,1,'CONTRIBUTION','2026-01-25 14:53:21',1),(44,20000,'VALIDATED','CI260112.1717.B92348','2026-01-25 14:52:55','2026-01-25 14:49:12',13,58,12,1,'CONTRIBUTION','2026-01-25 14:52:55',1),(45,50000,'VALIDATED','PP260122.0047.B14675','2026-01-25 14:53:29','2026-01-25 14:50:28',13,56,12,1,'CONTRIBUTION','2026-01-25 14:53:29',1),(46,1012000,'VALIDATED','CI260117.1017.D93980','2026-01-25 14:53:18','2026-01-25 14:52:24',13,51,12,1,'CONTRIBUTION','2026-01-25 14:53:18',1),(47,50000,'VALIDATED','PP260125.1453.B16466','2026-01-25 15:02:26','2026-01-25 14:53:53',13,13,12,1,'CONTRIBUTION','2026-01-25 15:02:26',1),(48,50000,'VALIDATED','PP260117.1236.B93942','2026-01-25 15:02:21','2026-01-25 15:00:10',13,59,12,1,'CONTRIBUTION','2026-01-25 15:02:21',1);
/*!40000 ALTER TABLE `transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `firstname` varchar(45) NOT NULL,
  `lastname` varchar(45) NOT NULL,
  `username` varchar(45) NOT NULL,
  `email` varchar(45) DEFAULT NULL,
  `telephone` varchar(45) DEFAULT NULL,
  `password` varchar(100) NOT NULL,
  `birthday` date DEFAULT NULL,
  `isactive` tinyint NOT NULL DEFAULT '0',
  `isfirstlogin` tinyint NOT NULL DEFAULT '1',
  `createdat` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedat` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdby` int DEFAULT NULL,
  `updatedby` int DEFAULT NULL,
  `id_father` int DEFAULT NULL,
  `id_mother` int DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `gender` varchar(45) DEFAULT NULL,
  `contribution_tier` enum('LEVEL1','LEVEL2','LEVEL3','LEVEL4') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_users_users1_idx` (`createdby`),
  KEY `fk_users_users2_idx` (`updatedby`),
  KEY `fk_users_users3_idx` (`id_father`),
  KEY `fk_users_users4_idx` (`id_mother`),
  CONSTRAINT `fk_users_users1` FOREIGN KEY (`createdby`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_users_users2` FOREIGN KEY (`updatedby`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_users_users3` FOREIGN KEY (`id_father`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_users_users4` FOREIGN KEY (`id_mother`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=60 DEFAULT CHARSET=utf8mb3;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Kassa','Famille','kassa',NULL,NULL,'$pbkdf2-sha256$29000$.58zBqA05pyTUorxnjMmxA$CdQ.6j/IqkS0Mq1VE8934xqqd8Co.EhisIqUC122hWA','1910-01-01',0,0,'2026-01-12 08:57:44','2026-01-14 08:06:20',NULL,2,NULL,NULL,NULL,'male',NULL),(2,'admin','admin','admin','taslimamindiakassa80@gmail.com','+18192125756','$pbkdf2-sha256$29000$idFaq5Xyfm9NSYnx/h9D6A$kURJAOiEiAGNPLZijuYOGzewgj9Eg/eR9ApAVUnuG0A','1998-02-28',1,0,'2026-01-12 08:57:45','2026-01-16 09:08:16',NULL,2,NULL,NULL,'https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/users/admin.jpg',NULL,NULL),(3,'Thierno Mamoudou Foulah','Barry','grand-father',NULL,NULL,'$pbkdf2-sha256$29000$6f2/F0LonROiNIaQ0nrP.Q$1/oiPkH/nHmQFl0Yhux3MYhmei85tE7AJACMfp3XDac','1935-01-01',0,0,'2026-01-12 08:57:45','2026-01-19 17:49:14',NULL,2,1,NULL,NULL,'male',NULL),(4,'Mamadou Kindy','Barry','grand-mother',NULL,NULL,'$pbkdf2-sha256$29000$FKJ0DoFQqvVeK0WoVaoVAg$xG8t2V19A5iWHkZSFx.OHw/7KbPF4HOPiU.048IXWUY','1935-01-01',0,0,'2026-01-12 08:57:45','2026-01-19 17:28:36',NULL,2,1,NULL,'https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/users/mamadou.jpeg','female',NULL),(5,'Guest','User','guest',NULL,NULL,'$pbkdf2-sha256$29000$ag0BAIAQovQ.R4gR4rx3Lg$wkSpG7ua/MJXQLhARtOnAhVlIOqqjNGcCvvZwHoALms',NULL,0,0,'2026-01-12 08:57:45','2026-01-12 08:57:45',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(6,'No','Role','norole',NULL,NULL,'$pbkdf2-sha256$29000$NiYE4ByDUErpPee8l9Lauw$6VvKFWf2P0TZa1U/vaKEWnheq5/IGlv2qTsMm80H7jQ',NULL,0,0,'2026-01-12 08:57:45','2026-01-12 08:57:45',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(7,'member','member','member','test@kassatech.org','+18192125756','$pbkdf2-sha256$29000$8p6zVkqJESJEqNU6pzQGoA$JTHREQj/oE2DsuUhpGbjTcsUeLa8IcD0EqLVlbNtAto','1990-01-01',0,1,'2026-01-12 05:44:34','2026-01-23 07:56:37',2,2,NULL,NULL,NULL,NULL,'LEVEL1'),(8,'Hadja Rouguiatou','Barry','hrb1957',NULL,'+224622207515','$pbkdf2-sha256$29000$ac35v7dWyhljLKWUstb6fw$GtMdylUmJ.aoo5IiLPOWrPVmBcoM36pya676IQ/UvCs','1960-02-01',0,0,'2026-01-12 16:44:45','2026-01-23 10:31:39',2,2,3,4,'https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/users/hrb1957.jpg','female',NULL),(9,'Mamadou Taslima','Diallo','taslimamindiakassa','taslimamindiakassa80@gmail.com','+18192125756','$pbkdf2-sha256$29000$ZMwZw5iTcg7B2LuXEqK0lg$vjKC5maqMK8uT6erqeriXZMhxX/KkaJJNrWBw3/iBl0','1998-02-28',1,0,'2026-01-12 13:02:33','2026-01-20 11:36:40',2,9,33,8,'https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/users/taslimamindiakassa.jpg','male','LEVEL1'),(10,'Hadja Djenabou','Barry','hdb1952',NULL,NULL,'$pbkdf2-sha256$29000$3vt/j7GWUkppzbkXwpizVg$eRHYBcckz8OWJes2d7xGTliNB06//BLgX5LZVPS7V7o','1957-01-01',0,0,'2026-01-12 18:54:12','2026-01-21 20:40:53',2,11,3,4,NULL,'female',NULL),(11,'Aissatou','Sy','Aissatou Sy','Woulagel@hotmail.com','+14707364429','$pbkdf2-sha256$29000$Uqr13huDcO5dSymlFGKsVQ$7i4rqU9gVzBY7DOM5dKS2rslN8YS8n1ALANsr90.YWc','1988-07-18',1,0,'2026-01-12 14:43:13','2026-01-21 20:42:50',2,11,17,10,'https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/users/AissatouSy.jpeg','female','LEVEL1'),(12,'Nimatoulaye','Diallo','nd1980','nimatoulaye78@gmail.com','+224622460702','$pbkdf2-sha256$29000$xpgzprQWAoBQ6h2D8N77Pw$k1pEEnucH0R8g6STmOq5Dq.nY4jmnnmlGw34fE./uUM','1980-01-01',1,0,'2026-01-12 14:43:14','2026-01-21 21:18:03',2,2,18,23,NULL,'female','LEVEL1'),(13,'Kadiatou','Barry','kb1998','Kadiza.cherif.barry@gmail.com','+224624568507','$pbkdf2-sha256$29000$BIBwTinFmBNirFUqJWTsvQ$xBCgX91iaxxpWCReWEpl1dUsfuDO0ZBuB/xHDoEuHj0','1998-05-24',1,0,'2026-01-12 14:43:14','2026-01-21 21:23:28',2,2,19,24,'https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/users/kb1998.jpeg','female','LEVEL2'),(14,'Rouguiatou','Barry','rb1988',NULL,'+224626905417','$pbkdf2-sha256$29000$uHeOsRaCUGotpRSiVKr1Pg$HkDIud5xcDcsSuFQOe9uns8TB4JoAnhZLzerR0.TAPY','1988-05-05',1,0,'2026-01-12 14:43:14','2026-01-21 20:08:58',2,2,20,25,NULL,'female','LEVEL2'),(15,'Ibrahima','Barry','ib1990','ib1811521@gmail.com','+19296260202','$pbkdf2-sha256$29000$s5bS.t.7N4Zwbg3h3DtnjA$CeuMwcjQ5l65qRhVBfpoppfXjxj89JKCcCLikHKAIHs','1990-02-15',1,0,'2026-01-12 14:43:15','2026-01-21 19:22:00',2,2,21,26,'https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/users/ib1990.jpeg','male','LEVEL1'),(16,'Amadou Tidiane','Barry','atb2003',NULL,'+224611922160','$pbkdf2-sha256$29000$XOtdi9Haew/hXEtJCQEg5A$UkNR9tgdoG/UyYuCXDMUsZkSGlz7Gx77hhyUaP9ngMU','2003-05-03',1,1,'2026-01-12 14:43:15','2026-01-13 10:15:50',2,2,22,27,'https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/users/atb2003.jpg','male','LEVEL3'),(17,'Ousmane Tanou','Sy','ots1950',NULL,NULL,'$pbkdf2-sha256$29000$3nsvxRjjnBNC6L23FmLsHQ$9QCfflUFs46pk.R7qjglERt8RE8WiBHzDUXlz2zut1A','1950-03-15',0,0,'2026-01-12 14:44:05','2026-01-12 21:05:23',2,2,NULL,NULL,NULL,'male',NULL),(18,'Madiou','Diallo','md1946',NULL,NULL,'$pbkdf2-sha256$29000$Nab0PkeIESLEeG.N8b7Xug$6K5vEkboG/WMsJFEWDy/0.IV24pYL67KZgkxZPFMyxM','1946-01-01',0,0,'2026-01-12 14:44:06','2026-01-12 21:05:08',2,2,NULL,NULL,NULL,'male',NULL),(19,'Chérif Abdoulaye','Barry','cab1970',NULL,NULL,'$pbkdf2-sha256$29000$cG5t7X0vRUjpPSfEeE9pTQ$Wgtv74ZW2Wd3M6XXPBiWSEXX7VuM.9pjv80/3K.BCy8','1970-01-01',0,0,'2026-01-12 14:44:06','2026-01-12 21:00:27',2,2,3,4,'https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/users/cab1970.jpeg','male',NULL),(20,'Mamadou Yassarou','Barry','myb1960',NULL,NULL,'$pbkdf2-sha256$29000$OOdc6/1fa80557w3xjiH0A$KQEyE1iAMByu728k0sE6AshZnUMXTwXnN5SJNIgS45w','1960-01-01',0,0,'2026-01-12 14:44:06','2026-01-12 21:03:02',2,2,NULL,NULL,NULL,'male',NULL),(21,'Mamadou Yhidhadho','Barry','myb1950',NULL,NULL,'$pbkdf2-sha256$29000$HWNsrXWu9V4LAaA0xtjbGw$ZNSyAKfDBse5F4w8kJtQy5JHpqA4Ug8UK3MPQdrr6uc','1950-01-01',0,0,'2026-01-12 14:44:07','2026-01-12 21:02:43',2,2,3,4,'https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/users/myb1950.jpeg','male',NULL),(22,'Saidy Mouhadal habibou','Barry','smhb1964',NULL,NULL,'$pbkdf2-sha256$29000$2fu/1xoDICTEmJPyPuc8Rw$hI0S0I3wCCv9my2BoHZwDZHrs4C/snAACpjgZGvxNDs','1964-01-01',0,0,'2026-01-12 14:44:07','2026-01-12 21:04:29',2,2,3,4,'https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/users/smhb1964.jpeg','male',NULL),(23,'Oumou koultoumy','Barry','okb1956',NULL,NULL,'$pbkdf2-sha256$29000$bQ0BwNh7T8lZK2VMSSmFkA$bF6npUKEkm2GcdoXvnKDCep0xCajCPeuxa1BOmrbC78','1956-01-01',0,0,'2026-01-12 14:44:16','2026-01-12 21:03:49',2,2,3,4,NULL,'female',NULL),(24,'Oumou Hawa','Barry','ohb1980',NULL,NULL,'$pbkdf2-sha256$29000$3/tfSwkhhBACgFCqVWpt7Q$xY7b7U80zwMmrvZ31MGtmuexdm0.pdSMqpPWNvR56bc','1980-01-01',0,0,'2026-01-12 14:44:16','2026-01-12 21:03:32',2,2,NULL,NULL,'https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/users/ohb1980.jpeg','female',NULL),(25,'Aissatou Tidianiatou','Barry','atb1969',NULL,NULL,'$pbkdf2-sha256$29000$19r7n3PunTMGoLS2Vup9jw$Ouut27GemtoL5bEc8UrniHwftAje2Hs0.HcFt3PZhzM','1969-01-02',0,0,'2026-01-12 14:44:16','2026-01-12 21:01:21',2,2,3,4,NULL,'female',NULL),(26,'Aïssatou','Barry','ab1970',NULL,NULL,'$pbkdf2-sha256$29000$5pyztjaGMEaIEaK0llKK8Q$3u15DaMHl.JfOemrMz89HL71ZA7ZfG./1ijv2DwnC5U','1970-01-01',0,0,'2026-01-12 14:44:17','2026-01-12 21:01:46',2,2,NULL,NULL,'https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/users/ab1970.jpeg','female',NULL),(27,'Hawa Baillo','Diallo','hbd1984',NULL,NULL,'$pbkdf2-sha256$29000$snZuLaUUAmAMIQSgdA6BUA$yenTkAQ.30zMIjEb6RX7nbBrvAtzHoJeZNPJuUJTq.M','1984-03-02',0,0,'2026-01-12 14:44:17','2026-01-12 21:04:45',2,2,NULL,NULL,'https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/users/hbd1984.jpeg','female',NULL),(28,'Hadja Adama','Barry','Hadja Adama',NULL,'+224622363896','$pbkdf2-sha256$29000$fC/l3BtjrFVK6X0vhTCGEA$Xu6a225RandhzCTGerBv/vjlwHsDQEUqDXgT5UH6bUQ','1974-01-11',1,0,'2026-01-12 15:05:34','2026-01-21 20:32:58',2,11,21,NULL,NULL,'female','LEVEL2'),(29,'Nafissatou','Barry','nb1970',NULL,NULL,'$pbkdf2-sha256$29000$hBBibM3Zu1dqzfm/FyIEAA$9MRM.gab0k7WS/oLSsd0wlk4/rOYgiE.XYIGPZdEsA4','1970-05-10',0,0,'2026-01-12 15:45:28','2026-01-12 21:03:23',2,2,3,4,NULL,'female',NULL),(30,'Rouguiatou','Barry','rb1988a',NULL,NULL,'$pbkdf2-sha256$29000$utc6xzhnjNHaW4vxvvd.bw$DnKQq5e6WEF5jvnMy8kel.uKgW9MNXoeyGln.jMULgk','1988-01-01',0,0,'2026-01-13 06:12:02','2026-01-13 06:12:02',2,2,NULL,NULL,'https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/users/rb1988a.jpg','female',NULL),(31,'Mamadou Hidhadho','Barry','mhb2007',NULL,'+224621624151','$pbkdf2-sha256$29000$vVfqPafUek8JAQAAwHiPUQ$y27fwkmfiXOjosB5K8hNn4cVAQTGIAISN94ZyVeOSM0','2007-08-01',1,1,'2026-01-13 06:18:51','2026-01-16 02:55:15',2,2,32,30,'https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/users/mhb2007.jpg','male','LEVEL3'),(32,'Amadou Tidiane','Barry','atb1967',NULL,NULL,'$pbkdf2-sha256$29000$/x8jJATg/H/vHeP8H2MsxQ$Htx5JolEuqi7gKE/wAVK03Rg4vkgwZQEIdgt3Zx8Fnk','1967-01-01',0,0,'2026-01-13 06:21:00','2026-01-13 11:21:25',2,2,NULL,NULL,'https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/users/atb1967.jpg','male',NULL),(33,'Ismael','Diallo','id1952',NULL,NULL,'$pbkdf2-sha256$29000$/v8fA4AwBkAoZcw5ZwzhnA$f.xkvJBN.TyuwqzeROwJEkSm38XK7ab.i2.igzL8ALo','1957-01-01',0,0,'2026-01-13 13:52:07','2026-01-23 10:32:42',2,2,NULL,NULL,'https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/users/id1952.jpg','male',NULL),(34,'Nafisatou','Balde','nb1976',NULL,'+32497077023','$pbkdf2-sha256$29000$W.s9J6SUsrbWOkcoJWQMwQ$.qN8CsVvHswYNBFfjhJ5.20j8DVajpljqQoXAqgaxCI','1976-07-07',1,0,'2026-01-13 14:34:32','2026-01-21 14:01:06',9,9,35,8,'https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/users/nb1976.jpg','female','LEVEL1'),(35,'Elhadj Mouctar','Balde','emb1922',NULL,NULL,'$pbkdf2-sha256$29000$YwyBMAagNEYoRUhJ6X1PaQ$5Uqu9s5keuBoAf8zaqZkfFfi7RZ7BIzu9DS06Hod4sg','1922-01-01',0,0,'2026-01-14 12:24:47','2026-01-14 12:24:47',2,2,NULL,NULL,NULL,'male',NULL),(36,'Fatoumata Binta','Diallo','fbb1992','fatoumatabintamind@gmail.com','+224622257264','$pbkdf2-sha256$29000$4vz/n9OaE0JoLUUIoTRm7A$jwkA6t5ofgDNXpS07OZJtOKK7H0tzGAYP0RfL3qfuTI','1992-12-31',1,1,'2026-01-16 19:55:31','2026-01-17 01:00:46',2,2,37,29,NULL,'female','LEVEL2'),(37,'Thierno Boubacar','Diallo','tbd1953',NULL,NULL,'$pbkdf2-sha256$29000$AYAwBmAspRRCyLlXypnTOg$YNcgQgm6Nv.gi6uWJfA3nst60dRrd7PhXLtp19AMWdE','1953-04-15',0,0,'2026-01-16 19:57:48','2026-01-16 19:57:48',2,2,NULL,NULL,NULL,'male',NULL),(39,'Thierno Rassidou','Barry','trb1945',NULL,NULL,'$pbkdf2-sha256$29000$rXUOwThHaO1day1FCKHUWg$gqRUI2FvfOWH1jsJjRrHCSVkLpkBJdWgwxL5kP5nhTY','1945-01-01',0,0,'2026-01-16 20:25:02','2026-01-16 20:25:02',2,2,NULL,NULL,NULL,'male',NULL),(40,'Mamadou Yidhadho','Barry','myb1990','mamadouyidhadho6@mail.com','+224620223279','$pbkdf2-sha256$29000$XyuFsLZ27n1PCSHkXAuhlA$yn1cb31V30KJ3Ts.ZBar7ydQGL6xF6yJkTYzV8wxvzI','1990-01-24',1,0,'2026-01-16 20:26:39','2026-01-22 13:34:51',2,2,39,8,'https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/users/myb1990.jpeg','male','LEVEL1'),(41,'treasury','treasury','treasury',NULL,NULL,'$pbkdf2-sha256$29000$pXSutdYaozTGeG8tRWhNqQ$B/6ld.ZG6zhytN4nny5G16VqcfsXKeZaSwsYVFxex0s','1998-01-01',1,0,'2026-01-16 22:54:28','2026-01-25 14:35:10',2,2,NULL,NULL,NULL,NULL,'LEVEL2'),(42,'board','board','board',NULL,NULL,'$pbkdf2-sha256$29000$UArhHEPovReCsPZ.L.Xcuw$BGwOH2ifzTitS7tgg1tkw.ZvhkbxYd9c4cpDJSbgylw',NULL,0,0,'2026-01-16 22:58:12','2026-01-23 07:56:52',2,2,NULL,NULL,NULL,NULL,'LEVEL3'),(43,'Thierno Mamoudou','Barry','tmb1970',NULL,NULL,'$pbkdf2-sha256$29000$lhIiZKxVKoVwDiEkZKy11g$7XBsUeTQvGm9J1Zwq3xYcLgXBhu3ARzsEwjscrfuE6s','1970-01-11',1,1,'2026-01-19 12:48:38','2026-01-19 12:48:38',2,2,NULL,10,NULL,'male','LEVEL2'),(44,'Ramadane','Barry','rb2006','bbbbbbtyyyy@gmail.com','+224629203698','$pbkdf2-sha256$29000$8967dw7hPKe0FoIQQgjhnA$9RyFHBK9ozSTRvLmxKcBkh9HKZa8K76DqOXZvzLWTM4','2006-01-09',1,1,'2026-01-19 12:53:34','2026-01-19 17:56:24',2,2,43,28,'https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/users/rb2006.jpg','male','LEVEL3'),(45,'treasury1','treasury1','treasury1',NULL,NULL,'$pbkdf2-sha256$29000$PMeY0/pfixFCyNn73xvjnA$gNhVqaLgBEomvnuJ8uH7Aq4ZJK9edWFgnIaxCHWPXNs','1998-01-01',0,0,'2026-01-20 14:25:39','2026-01-23 07:57:15',2,2,NULL,NULL,NULL,'male',NULL),(46,'Mamadou Yassar ','Barry','myb1998','mybarry232@gmail.com','+15817611656','$pbkdf2-sha256$29000$4vz/XyvlPCekVKpVCuHcOw$dBJ5M1GcbYFKWiIvNrCfqZVt2N7WetFyPGjkwa6w0sg','1998-02-13',1,0,'2026-01-21 19:30:59','2026-01-24 01:35:09',15,2,21,26,NULL,'male','LEVEL1'),(47,'Siradio ','Sy','Siradio',NULL,'+491636752165','$pbkdf2-sha256$29000$JeTcW6u1dm4tpRTCuLd2rg$OgfhkxK3M7dSo0.ZGy54EHdzdN24THnZAV5WfUfoILo','1979-06-21',1,1,'2026-01-21 20:24:11','2026-01-21 20:26:34',11,11,17,10,'https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/users/Siradio.jpeg','male',NULL),(48,'Oumou koulsoumy','Barry ','okb2003',NULL,'+224610482620','$pbkdf2-sha256$29000$AOBcyzmntLa2tpbS.p9Tqg$OtIc7QvOIRfMyNm/ovzjHTVc2JDMHVKFUphy6gBPlKk','2003-08-28',0,1,'2026-01-21 20:27:57','2026-01-21 20:27:57',14,14,20,25,NULL,'female','LEVEL3'),(50,'Elhadj Amadou','Barry','eab1995','kadiza.cherif.barry@gmail.com',NULL,'$pbkdf2-sha256$29000$sfZeixHinBOiFEKoVUoJoQ$CPS1VhbsTiLT0KOeJ8C2YAqLH2FEkochgp68TXcuZB0','1995-12-01',1,1,'2026-01-21 21:43:36','2026-01-21 22:13:18',13,2,19,24,NULL,'male','LEVEL1'),(51,'Mamadou Kindy','Balde','mkb1979',NULL,'+32497077023','$pbkdf2-sha256$29000$2BsDoFQqJcR4DyFE6D0nBA$Ly60vKzgG7c4Dwmc14OO.IlpEYeeXjgdQwn92bIHDpc','1979-11-21',1,1,'2026-01-22 00:04:20','2026-01-22 07:09:02',9,9,35,8,'https://kassatech-stockage.s3.ca-central-1.amazonaws.com/images_family_kassa_project/users/mkb1979.jpg','female','LEVEL1'),(52,'Mamadou Maka','Balde','mmb1975',NULL,NULL,'$pbkdf2-sha256$29000$XyslZCwFYOzde6.VEkIoxQ$PabhD90eZ8vjFG5evlnmANBG0TnhHubQUwkvWOWLBhs','1975-01-01',0,0,'2026-01-22 04:26:46','2026-01-22 04:26:46',9,9,NULL,NULL,NULL,'male',NULL),(53,'Ibrahima','Balde','ib2007',NULL,NULL,'$pbkdf2-sha256$29000$Tum9t1ZKSSnlnDOGcG7tvQ$wghcN1Xkbs42/B5iyLBOt54NKWnZ8/Gu6zsYviEe064','2007-01-20',1,1,'2026-01-22 04:31:37','2026-01-22 11:33:11',9,9,52,34,NULL,'male','LEVEL3'),(54,'Rouguiatou','Balde','rb2009',NULL,NULL,'$pbkdf2-sha256$29000$xPjfG.P8X8sZI.QcY.xd6w$djFFdDQj0WrLByoskuZlI0dPcmeubXxe17lG.FKR.uU','2009-03-01',0,1,'2026-01-22 06:50:28','2026-01-22 06:50:28',9,9,52,34,NULL,'female',NULL),(55,'Thierno Mahmoudou','Barry','tmb2001',NULL,'+33748487490','$pbkdf2-sha256$29000$mFMqRQhhLKX0Psc4pxRC6A$n7U2IACBtcQs1jOtgdFhijS2EtIetuHxtGEGOHL3Fh0','2001-01-01',1,1,'2026-01-22 20:32:13','2026-01-23 08:01:51',13,2,19,24,NULL,'male','LEVEL1'),(56,'Habibatou','Barry','hb2004',NULL,'+224627113695','$pbkdf2-sha256$29000$ypkzBgAAAMAYozQmBCDkvA$bNgPhRfDO9OMk7/FCZFC2jDScz/wL6hyteE0O5W6fiM','2004-07-29',1,1,'2026-01-22 20:35:18','2026-01-25 14:45:59',13,2,19,24,NULL,'female','LEVEL2'),(57,'Mamadou samba ','Barry ','msb1970',NULL,'+224626905416','$pbkdf2-sha256$29000$m3MuJcQ4x/gfw/g/B2BsDQ$G8cjENH5s/rZ20Ajj7cNNt09Iy5jVxY.jWjg5rhMFYI','1970-01-01',1,1,'2026-01-24 02:08:38','2026-01-24 02:08:38',14,14,20,25,NULL,'male','LEVEL2'),(58,'Abdoul Madjid','Diallo','amd2007',NULL,NULL,'$pbkdf2-sha256$29000$GINwrtUaozRmjLG2lhJCKA$Gg6pX5fIx7Z6oRhv6ccYvCt2MxAxlE27ZGk6HitD7w8','2007-01-01',1,1,'2026-01-25 09:45:35','2026-01-25 09:45:35',2,2,37,29,NULL,'male','LEVEL3'),(59,'Mamadou Alpha','Barry','mab1996',NULL,'+33753796963','$pbkdf2-sha256$29000$UyrlXEuptVbK2XvvPQfAmA$Ca3ScTzzGRz92TXiwUYe6avNKxebeuEitvYpU.YJnlU','1996-01-01',1,1,'2026-01-25 09:57:51','2026-01-25 14:59:05',2,2,21,NULL,NULL,'male','LEVEL1');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-01-26  6:11:28
