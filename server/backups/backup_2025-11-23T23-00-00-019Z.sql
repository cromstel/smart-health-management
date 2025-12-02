-- MySQL dump 10.13  Distrib 8.4.7, for Win64 (x86_64)
--
-- Host: localhost    Database: smart_health_manager
-- ------------------------------------------------------
-- Server version	8.4.7

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
-- Table structure for table `accounts`
--

DROP TABLE IF EXISTS `accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `account_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('asset','liability','income','expense') COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_id` bigint unsigned DEFAULT NULL,
  `level` int DEFAULT '0',
  `balance` decimal(15,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `account_code` (`account_code`),
  KEY `parent_id` (`parent_id`),
  KEY `idx_account_code` (`account_code`),
  KEY `idx_type` (`type`),
  CONSTRAINT `accounts_ibfk_1` FOREIGN KEY (`parent_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=181 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts`
--

LOCK TABLES `accounts` WRITE;
/*!40000 ALTER TABLE `accounts` DISABLE KEYS */;
INSERT INTO `accounts` VALUES (1,'1000','Assets','asset',NULL,0,50000.00,'2025-11-18 06:46:30','2025-11-18 06:46:30'),(2,'2000','Liabilities','liability',NULL,0,0.00,'2025-11-18 06:46:30','2025-11-18 06:46:30'),(3,'3000','Income','income',NULL,0,-17600.00,'2025-11-18 06:46:30','2025-11-23 21:56:10'),(4,'4000','Expenses','expense',NULL,0,0.00,'2025-11-18 06:46:30','2025-11-18 06:46:30'),(5,'ACC-1d88c6f4','Test Account','income',NULL,0,0.00,'2025-11-18 06:52:46','2025-11-18 06:52:46'),(6,'ACC-66ccf21c','Test Account','income',NULL,0,0.00,'2025-11-18 06:52:46','2025-11-18 06:52:46'),(7,'ACC-942378bb','Test Account','income',NULL,0,0.00,'2025-11-18 06:52:47','2025-11-18 06:52:47'),(8,'ACC-d57d80d9','Test Account','income',NULL,0,0.00,'2025-11-18 06:53:03','2025-11-18 06:53:03'),(9,'ACC-97f0beb1','Test Account','income',NULL,0,0.00,'2025-11-18 06:53:03','2025-11-18 06:53:03'),(10,'ACC-ef735091','Test Account','income',NULL,0,0.00,'2025-11-18 06:53:04','2025-11-18 06:53:04'),(11,'ACC-f4a0a883','Test Account','income',NULL,0,0.00,'2025-11-18 06:53:09','2025-11-18 06:53:09'),(12,'ACC-62d07151','Test Account','income',NULL,0,0.00,'2025-11-18 06:53:49','2025-11-18 06:53:49'),(13,'ACC-1bc30d70','Test Account','income',NULL,0,0.00,'2025-11-18 06:54:14','2025-11-18 06:54:14'),(14,'ACC-b52d9ed9','Test Account','income',NULL,0,0.00,'2025-11-18 06:54:58','2025-11-18 06:54:58'),(15,'ACC-ba238597','Test Account','income',NULL,0,0.00,'2025-11-18 06:55:40','2025-11-18 06:55:40'),(16,'ACC-ea4c0edf','Test Account','income',NULL,0,0.00,'2025-11-18 06:55:46','2025-11-18 06:55:46'),(17,'ACC-37338451','Test Account','income',NULL,0,0.00,'2025-11-18 06:56:03','2025-11-18 06:56:03'),(18,'ACC-7a858687','Test Account','income',NULL,0,0.00,'2025-11-18 06:56:08','2025-11-18 06:56:08'),(19,'ACC-6210937e','Test Account','income',NULL,0,0.00,'2025-11-18 06:56:28','2025-11-18 06:56:28'),(20,'ACC-5fd69e4e','Test Account','income',NULL,0,0.00,'2025-11-18 06:56:30','2025-11-18 06:56:30'),(21,'ACC-8f7d4969','Test Account','income',NULL,0,0.00,'2025-11-18 07:02:11','2025-11-18 07:02:11'),(22,'ACC-285378b5','Test Account','income',NULL,0,0.00,'2025-11-18 07:25:09','2025-11-18 07:25:09'),(23,'ACC-48002bfb','Test Account','income',NULL,0,0.00,'2025-11-18 07:25:10','2025-11-18 07:25:10'),(24,'ACC-7829f515','Test Account','income',NULL,0,0.00,'2025-11-18 07:27:13','2025-11-18 07:27:13'),(25,'ACC-c3b80995','Test Account','income',NULL,0,0.00,'2025-11-18 07:28:06','2025-11-18 07:28:06'),(26,'ACC-07a04a85','Test Account','income',NULL,0,0.00,'2025-11-18 07:28:11','2025-11-18 07:28:11'),(27,'ACC-e55817c5','Test Account','income',NULL,0,0.00,'2025-11-18 07:28:12','2025-11-18 07:28:12'),(28,'ACC-08856cff','Test Account','income',NULL,0,0.00,'2025-11-18 07:28:29','2025-11-18 07:28:29'),(29,'ACC-f2f2cdc4','Test Account','income',NULL,0,0.00,'2025-11-18 07:28:29','2025-11-18 07:28:29'),(30,'ACC-46501064','Test Account','income',NULL,0,0.00,'2025-11-18 07:28:30','2025-11-18 07:28:30'),(31,'ACC-073ebf44','Test Account','income',NULL,0,0.00,'2025-11-18 07:28:31','2025-11-18 07:28:31'),(32,'ACC-8432d54f','Test Account','income',NULL,0,0.00,'2025-11-18 07:28:38','2025-11-18 07:28:38'),(33,'ACC-04539bf8','Test Account','income',NULL,0,0.00,'2025-11-18 07:28:57','2025-11-18 07:28:57'),(34,'ACC-958bb1c4','Test Account','income',NULL,0,0.00,'2025-11-18 07:28:57','2025-11-18 07:28:57'),(35,'ACC-c9ba0d0b','Test Account','income',NULL,0,0.00,'2025-11-18 07:29:07','2025-11-18 07:29:07'),(36,'ACC-2d563eae','Test Account','income',NULL,0,0.00,'2025-11-18 07:29:20','2025-11-18 07:29:20'),(37,'ACC-c33edcad','Test Account','income',NULL,0,0.00,'2025-11-18 07:29:21','2025-11-18 07:29:21'),(38,'ACC-af62a859','Test Account','income',NULL,0,0.00,'2025-11-18 07:29:28','2025-11-18 07:29:28'),(39,'ACC-bd9881b4','Test Account','income',NULL,0,0.00,'2025-11-18 07:29:53','2025-11-18 07:29:53'),(40,'ACC-2f175ca7','Test Account','income',NULL,0,0.00,'2025-11-18 07:29:59','2025-11-18 07:29:59'),(41,'ACC-48048480','Test Account','income',NULL,0,0.00,'2025-11-18 07:32:10','2025-11-18 07:32:10'),(42,'ACC-ccd097d4','Test Account','income',NULL,0,0.00,'2025-11-18 18:28:33','2025-11-18 18:28:33'),(43,'ACC-a247d836','Test Account','income',NULL,0,0.00,'2025-11-18 18:28:35','2025-11-18 18:28:35'),(44,'ACC-ec59eab2','Test Account','income',NULL,0,0.00,'2025-11-18 18:28:37','2025-11-18 18:28:37'),(45,'ACC-4d05379f','Test Account','income',NULL,0,0.00,'2025-11-18 18:28:37','2025-11-18 18:28:37'),(46,'ACC-36bd8bfd','Test Account','income',NULL,0,0.00,'2025-11-18 18:28:43','2025-11-18 18:28:43'),(47,'ACC-57cf39e9','Test Account','income',NULL,0,0.00,'2025-11-18 18:28:44','2025-11-18 18:28:44'),(48,'ACC-d13ad827','Test Account','income',NULL,0,0.00,'2025-11-18 18:28:44','2025-11-18 18:28:44'),(49,'ACC-3151ed6e','Test Account','income',NULL,0,0.00,'2025-11-18 18:34:24','2025-11-18 18:34:24'),(50,'ACC-0afc157f','Test Account','income',NULL,0,0.00,'2025-11-18 18:34:28','2025-11-18 18:34:28'),(51,'ACC-8a103725','Test Account','income',NULL,0,0.00,'2025-11-18 21:00:24','2025-11-18 21:00:24'),(52,'ACC-e2a7d893','Test Account','income',NULL,0,0.00,'2025-11-18 23:31:46','2025-11-18 23:31:46'),(53,'ACC-24159d82','Test Account','income',NULL,0,0.00,'2025-11-18 23:31:47','2025-11-18 23:31:47'),(54,'ACC-4ab07b74','Test Account','income',NULL,0,0.00,'2025-11-18 23:33:45','2025-11-18 23:33:45'),(55,'ACC-32a94538','Test Account','income',NULL,0,0.00,'2025-11-18 23:37:48','2025-11-18 23:37:48'),(56,'ACC-dfc843fc','Test Account','income',NULL,0,0.00,'2025-11-18 23:37:50','2025-11-18 23:37:50'),(57,'ACC-976a9558','Test Account','income',NULL,0,0.00,'2025-11-19 00:08:03','2025-11-19 00:08:03'),(58,'ACC-2c238535','Test Account','income',NULL,0,0.00,'2025-11-19 00:33:03','2025-11-19 00:33:03'),(59,'ACC-5a170f71','Test Account','income',NULL,0,0.00,'2025-11-19 01:03:23','2025-11-19 01:03:23'),(60,'ACC-e4185a40','Test Account','income',NULL,0,0.00,'2025-11-19 01:33:53','2025-11-19 01:33:53'),(61,'ACC-046978df','Test Account','income',NULL,0,0.00,'2025-11-19 02:04:20','2025-11-19 02:04:20'),(62,'ACC-34cc8149','Test Account','income',NULL,0,0.00,'2025-11-19 06:35:01','2025-11-19 06:35:01'),(63,'ACC-4c1b2fa4','Test Account','income',NULL,0,0.00,'2025-11-19 07:07:14','2025-11-19 07:07:14'),(64,'ACC-36f22e57','Test Account','income',NULL,0,0.00,'2025-11-19 07:38:10','2025-11-19 07:38:10'),(65,'ACC-a141e794','Test Account','income',NULL,0,0.00,'2025-11-19 18:36:23','2025-11-19 18:36:23'),(66,'ACC-e4710386','Test Account','income',NULL,0,0.00,'2025-11-19 20:30:15','2025-11-19 20:30:15'),(67,'ACC-d1cafdba','Test Account','income',NULL,0,0.00,'2025-11-19 20:30:16','2025-11-19 20:30:16'),(68,'ACC-da27b769','Test Account','income',NULL,0,0.00,'2025-11-19 20:31:50','2025-11-19 20:31:50'),(69,'ACC-a7752620','Test Account','income',NULL,0,0.00,'2025-11-19 20:42:52','2025-11-19 20:42:52'),(70,'ACC-a835cc5b','Test Account','income',NULL,0,0.00,'2025-11-19 20:44:19','2025-11-19 20:44:19'),(71,'ACC-35ab59db','Test Account','income',NULL,0,0.00,'2025-11-19 20:47:39','2025-11-19 20:47:39'),(72,'ACC-48dea021','Test Account','income',NULL,0,0.00,'2025-11-19 20:52:52','2025-11-19 20:52:52'),(73,'ACC-acc600f4','Test Account','income',NULL,0,0.00,'2025-11-19 20:52:53','2025-11-19 20:52:53'),(74,'ACC-50df7bd8','Test Account','income',NULL,0,0.00,'2025-11-19 21:02:30','2025-11-19 21:02:30'),(75,'ACC-c507df3d','Test Account','income',NULL,0,0.00,'2025-11-19 21:02:35','2025-11-19 21:02:35'),(76,'ACC-e5103753','Test Account','income',NULL,0,0.00,'2025-11-19 21:05:12','2025-11-19 21:05:12'),(77,'ACC-d7afa1dc','Test Account','income',NULL,0,0.00,'2025-11-19 21:05:12','2025-11-19 21:05:12'),(78,'ACC-cc074246','Test Account','income',NULL,0,0.00,'2025-11-19 21:13:24','2025-11-19 21:13:24'),(79,'ACC-e81280a3','Test Account','income',NULL,0,0.00,'2025-11-19 21:13:24','2025-11-19 21:13:24'),(80,'ACC-dca8cd75','Test Account','income',NULL,0,0.00,'2025-11-19 21:14:02','2025-11-19 21:14:02'),(81,'ACC-929d3e96','Test Account','income',NULL,0,0.00,'2025-11-19 21:14:02','2025-11-19 21:14:02'),(82,'ACC-d80f78bd','Test Account','income',NULL,0,0.00,'2025-11-19 21:18:04','2025-11-19 21:18:04'),(83,'ACC-4a80018e','Test Account','income',NULL,0,0.00,'2025-11-19 21:28:55','2025-11-19 21:28:55'),(84,'ACC-5a44a476','Test Account','income',NULL,0,0.00,'2025-11-19 21:32:16','2025-11-19 21:32:16'),(85,'ACC-a40fe69a','Test Account','income',NULL,0,0.00,'2025-11-19 21:32:17','2025-11-19 21:32:17'),(86,'ACC-9ef052d4','Test Account','income',NULL,0,0.00,'2025-11-19 21:34:13','2025-11-19 21:34:13'),(87,'ACC-deeb3a8c','Test Account','income',NULL,0,0.00,'2025-11-19 21:34:15','2025-11-19 21:34:15'),(88,'ACC-9da7f54e','Test Account','income',NULL,0,0.00,'2025-11-19 21:34:32','2025-11-19 21:34:32'),(89,'ACC-f5a7de88','Test Account','income',NULL,0,0.00,'2025-11-19 21:34:32','2025-11-19 21:34:32'),(90,'ACC-b22c1461','Test Account','income',NULL,0,0.00,'2025-11-19 21:35:08','2025-11-19 21:35:08'),(91,'ACC-6a0cf71c','Test Account','income',NULL,0,0.00,'2025-11-19 21:44:31','2025-11-19 21:44:31'),(92,'ACC-c1e71c4d','Test Account','income',NULL,0,0.00,'2025-11-19 21:49:55','2025-11-19 21:49:55'),(93,'ACC-1dcbc620','Test Account','income',NULL,0,0.00,'2025-11-19 21:50:14','2025-11-19 21:50:14'),(94,'ACC-964f6965','Test Account','income',NULL,0,0.00,'2025-11-19 22:20:27','2025-11-19 22:20:27'),(95,'ACC-8eb7749f','Test Account','income',NULL,0,0.00,'2025-11-19 22:20:28','2025-11-19 22:20:28'),(96,'ACC-f7bc4971','Test Account','income',NULL,0,0.00,'2025-11-19 22:21:02','2025-11-19 22:21:02'),(97,'ACC-6c0ef69d','Test Account','income',NULL,0,0.00,'2025-11-19 22:21:05','2025-11-19 22:21:05'),(98,'ACC-74157f28','Test Account','income',NULL,0,0.00,'2025-11-19 22:39:54','2025-11-19 22:39:54'),(99,'ACC-44056cda','Test Account','income',NULL,0,0.00,'2025-11-19 22:39:56','2025-11-19 22:39:56'),(100,'ACC-7119cf42','Test Account','income',NULL,0,0.00,'2025-11-19 22:41:22','2025-11-19 22:41:22'),(101,'ACC-bf7dbbed','Test Account','income',NULL,0,0.00,'2025-11-19 22:42:52','2025-11-19 22:42:52'),(102,'ACC-585b40a8','Test Account','income',NULL,0,0.00,'2025-11-19 22:42:55','2025-11-19 22:42:55'),(103,'ACC-98b4ccb8','Test Account','income',NULL,0,0.00,'2025-11-19 22:44:48','2025-11-19 22:44:48'),(104,'ACC-792b06f3','Test Account','income',NULL,0,0.00,'2025-11-19 22:48:42','2025-11-19 22:48:42'),(105,'ACC-00d4b635','Test Account','income',NULL,0,0.00,'2025-11-19 22:54:11','2025-11-19 22:54:11'),(106,'ACC-9510cb73','Test Account','income',NULL,0,0.00,'2025-11-19 22:54:24','2025-11-19 22:54:24'),(107,'ACC-36f53436','Test Account','income',NULL,0,0.00,'2025-11-19 23:08:16','2025-11-19 23:08:16'),(108,'ACC-513b00df','Test Account','income',NULL,0,0.00,'2025-11-19 23:14:59','2025-11-19 23:14:59'),(109,'ACC-73a431c5','Test Account','income',NULL,0,0.00,'2025-11-19 23:24:38','2025-11-19 23:24:38'),(110,'ACC-45590d67','Test Account','income',NULL,0,0.00,'2025-11-19 23:29:52','2025-11-19 23:29:52'),(111,'ACC-2b057764','Test Account','income',NULL,0,0.00,'2025-11-19 23:30:05','2025-11-19 23:30:05'),(112,'ACC-72b035f4','Test Account','income',NULL,0,0.00,'2025-11-19 23:30:09','2025-11-19 23:30:09'),(113,'ACC-1fde0712','Test Account','income',NULL,0,0.00,'2025-11-19 23:30:34','2025-11-19 23:30:34'),(114,'ACC-d27e79a3','Test Account','income',NULL,0,0.00,'2025-11-19 23:33:08','2025-11-19 23:33:08'),(115,'ACC-b1023702','Test Account','income',NULL,0,0.00,'2025-11-19 23:33:09','2025-11-19 23:33:09'),(116,'ACC-fc71f862','Test Account','income',NULL,0,0.00,'2025-11-19 23:35:06','2025-11-19 23:35:06'),(117,'ACC-b63e1bd9','Test Account','income',NULL,0,0.00,'2025-11-19 23:57:15','2025-11-19 23:57:15'),(118,'ACC-d51c461b','Test Account','income',NULL,0,0.00,'2025-11-19 23:57:16','2025-11-19 23:57:16'),(119,'ACC-80acbc26','Test Account','income',NULL,0,0.00,'2025-11-20 00:35:55','2025-11-20 00:35:55'),(120,'ACC-11d1fe88','Test Account','income',NULL,0,0.00,'2025-11-20 00:36:28','2025-11-20 00:36:28'),(121,'ACC-d332037d','Test Account','income',NULL,0,0.00,'2025-11-21 19:57:33','2025-11-21 19:57:33'),(122,'ACC-534bc25e','Test Account','income',NULL,0,0.00,'2025-11-21 20:43:48','2025-11-21 20:43:48'),(123,'ACC-361ee998','Test Account','income',NULL,0,0.00,'2025-11-21 20:43:49','2025-11-21 20:43:49'),(124,'ACC-df54bd38','Test Account','income',NULL,0,0.00,'2025-11-21 21:07:01','2025-11-21 21:07:01'),(125,'ACC-8e9b7a5c','Test Account','income',NULL,0,0.00,'2025-11-21 21:22:51','2025-11-21 21:22:51'),(126,'ACC-40c00e4d','Test Account','income',NULL,0,0.00,'2025-11-21 22:07:26','2025-11-21 22:07:26'),(127,'ACC-e2438f10','Test Account','income',NULL,0,0.00,'2025-11-21 22:14:42','2025-11-21 22:14:42'),(128,'ACC-22b8eb8a','Test Account','income',NULL,0,0.00,'2025-11-21 22:28:52','2025-11-21 22:28:52'),(129,'ACC-95775e56','Test Account','income',NULL,0,0.00,'2025-11-21 22:34:17','2025-11-21 22:34:17'),(130,'ACC-391fedcd','Test Account','income',NULL,0,0.00,'2025-11-21 22:40:05','2025-11-21 22:40:05'),(131,'ACC-1ee2afaa','Test Account','income',NULL,0,0.00,'2025-11-21 23:37:13','2025-11-21 23:37:13'),(132,'ACC-9bbbf9e9','Test Account','income',NULL,0,0.00,'2025-11-22 00:04:13','2025-11-22 00:04:13'),(133,'ACC-34417cef','Test Account','income',NULL,0,0.00,'2025-11-22 00:27:28','2025-11-22 00:27:28'),(134,'ACC-0a232b4e','Test Account','income',NULL,0,0.00,'2025-11-22 00:32:09','2025-11-22 00:32:09'),(135,'ACC-347f3634','Test Account','income',NULL,0,0.00,'2025-11-22 00:39:31','2025-11-22 00:39:31'),(136,'ACC-c94ac4cc','Test Account','income',NULL,0,0.00,'2025-11-22 00:44:23','2025-11-22 00:44:23'),(137,'ACC-eb867b85','Test Account','income',NULL,0,0.00,'2025-11-22 01:04:32','2025-11-22 01:04:32'),(138,'ACC-def21261','Test Account','income',NULL,0,0.00,'2025-11-22 01:29:16','2025-11-22 01:29:16'),(139,'ACC-3c93064a','Test Account','income',NULL,0,0.00,'2025-11-22 01:29:21','2025-11-22 01:29:21'),(140,'ACC-c76a3537','Test Account','income',NULL,0,0.00,'2025-11-22 01:31:11','2025-11-22 01:31:11'),(141,'ACC-8aa77721','Test Account','income',NULL,0,0.00,'2025-11-22 01:34:06','2025-11-22 01:34:06'),(142,'ACC-519ab6a9','Test Account','income',NULL,0,0.00,'2025-11-22 14:09:30','2025-11-22 14:09:30'),(143,'ACC-64e423b0','Test Account','income',NULL,0,0.00,'2025-11-22 14:40:48','2025-11-22 14:40:48'),(144,'ACC-5b37e6d0','Test Account','income',NULL,0,0.00,'2025-11-22 15:13:23','2025-11-22 15:13:23'),(145,'ACC-5944b2b7','Test Account','income',NULL,0,0.00,'2025-11-22 15:13:27','2025-11-22 15:13:27'),(146,'ACC-4cbc9dc8','Test Account','income',NULL,0,0.00,'2025-11-22 16:52:12','2025-11-22 16:52:12'),(147,'ACC-064492da','Test Account','income',NULL,0,0.00,'2025-11-22 16:54:06','2025-11-22 16:54:06'),(148,'ACC-02f9e9ce','Test Account','income',NULL,0,0.00,'2025-11-22 17:24:19','2025-11-22 17:24:19'),(149,'ACC-a8c53d07','Test Account','income',NULL,0,0.00,'2025-11-22 17:54:35','2025-11-22 17:54:35'),(150,'ACC-fd2dc2e0','Test Account','income',NULL,0,0.00,'2025-11-22 18:24:59','2025-11-22 18:24:59'),(151,'ACC-9acf46b3','Test Account','income',NULL,0,0.00,'2025-11-22 18:59:17','2025-11-22 18:59:17'),(152,'ACC-f5f98151','Test Account','income',NULL,0,0.00,'2025-11-22 19:44:19','2025-11-22 19:44:19'),(153,'ACC-95b20860','Test Account','income',NULL,0,0.00,'2025-11-22 19:44:38','2025-11-22 19:44:38'),(154,'ACC-f9052b1d','Test Account','income',NULL,0,0.00,'2025-11-22 19:57:44','2025-11-22 19:57:44'),(155,'ACC-af9bf975','Test Account','income',NULL,0,0.00,'2025-11-22 20:17:54','2025-11-22 20:17:54'),(156,'ACC-3dc00551','Test Account','income',NULL,0,0.00,'2025-11-22 20:51:42','2025-11-22 20:51:42'),(157,'ACC-df4b9ba3','Test Account','income',NULL,0,0.00,'2025-11-22 21:22:08','2025-11-22 21:22:08'),(158,'ACC-9661efac','Test Account','income',NULL,0,0.00,'2025-11-22 21:52:29','2025-11-22 21:52:29'),(159,'ACC-705f8f59','Test Account','income',NULL,0,0.00,'2025-11-22 22:23:13','2025-11-22 22:23:13'),(160,'ACC-797e6502','Test Account','income',NULL,0,0.00,'2025-11-23 02:00:46','2025-11-23 02:00:46'),(161,'ACC-da210301','Test Account','income',NULL,0,0.00,'2025-11-23 02:05:17','2025-11-23 02:05:17'),(162,'ACC-4d220af7','Test Account','income',NULL,0,0.00,'2025-11-23 02:09:08','2025-11-23 02:09:08'),(163,'ACC-17da4dd2','Test Account','income',NULL,0,0.00,'2025-11-23 13:27:00','2025-11-23 13:27:00'),(164,'ACC-5418e35f','Test Account','income',NULL,0,0.00,'2025-11-23 13:27:13','2025-11-23 13:27:13'),(165,'ACC-6d8ab47d','Test Account','income',NULL,0,0.00,'2025-11-23 13:29:56','2025-11-23 13:29:56'),(166,'ACC-21888f54','Test Account','income',NULL,0,0.00,'2025-11-23 13:40:17','2025-11-23 13:40:17'),(167,'ACC-09ba4ed2','Test Account','income',NULL,0,0.00,'2025-11-23 14:44:10','2025-11-23 14:44:10'),(168,'ACC-70fdf713','Test Account','income',NULL,0,0.00,'2025-11-23 15:59:49','2025-11-23 15:59:49'),(169,'ACC-5c6281d5','Test Account','income',NULL,0,0.00,'2025-11-23 16:01:25','2025-11-23 16:01:25'),(170,'ACC-832a4b7e','Test Account','income',NULL,0,0.00,'2025-11-23 16:15:12','2025-11-23 16:15:12'),(171,'ACC-7c0cd28c','Test Account','income',NULL,0,0.00,'2025-11-23 18:15:02','2025-11-23 18:15:02'),(172,'ACC-318a60d4','Test Account','income',NULL,0,0.00,'2025-11-23 18:15:31','2025-11-23 18:15:31'),(173,'ACC-9ab0cdcf','Test Account','income',NULL,0,0.00,'2025-11-23 18:16:32','2025-11-23 18:16:32'),(174,'ACC-2ea97337','Test Account','income',NULL,0,0.00,'2025-11-23 18:18:11','2025-11-23 18:18:11'),(175,'ACC-11609945','Test Account','income',NULL,0,0.00,'2025-11-23 18:18:53','2025-11-23 18:18:53'),(176,'ACC-a8b50cda','Test Account','income',NULL,0,0.00,'2025-11-23 18:20:22','2025-11-23 18:20:22'),(177,'ACC-077e526e','Test Account','income',NULL,0,0.00,'2025-11-23 18:50:39','2025-11-23 18:50:39'),(178,'ACC-b287108b','Test Account','income',NULL,0,0.00,'2025-11-23 19:30:05','2025-11-23 19:30:05'),(179,'ACC-7335ae92','Test Account','income',NULL,0,0.00,'2025-11-23 21:54:31','2025-11-23 21:54:31'),(180,'ACC-9abf123e','Test Account','income',NULL,0,0.00,'2025-11-23 21:56:10','2025-11-23 21:56:10');
/*!40000 ALTER TABLE `accounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `allergies`
--

DROP TABLE IF EXISTS `allergies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `allergies` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `patient_id` bigint unsigned NOT NULL,
  `allergen` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `severity` enum('mild','moderate','severe') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `patient_id` (`patient_id`),
  CONSTRAINT `allergies_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `allergies`
--

LOCK TABLES `allergies` WRITE;
/*!40000 ALTER TABLE `allergies` DISABLE KEYS */;
INSERT INTO `allergies` VALUES (1,1,'Penicillin','severe','Causes anaphylactic shock.','2025-11-18 06:46:30');
/*!40000 ALTER TABLE `allergies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `appointment_reminders`
--

DROP TABLE IF EXISTS `appointment_reminders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `appointment_reminders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `appointment_id` bigint unsigned NOT NULL,
  `reminder_date` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `appointment_id` (`appointment_id`),
  CONSTRAINT `appointment_reminders_ibfk_1` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `appointment_reminders`
--

LOCK TABLES `appointment_reminders` WRITE;
/*!40000 ALTER TABLE `appointment_reminders` DISABLE KEYS */;
INSERT INTO `appointment_reminders` VALUES (1,1,'2025-11-18 23:00:00','2025-11-18 06:46:30');
/*!40000 ALTER TABLE `appointment_reminders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `appointments`
--

DROP TABLE IF EXISTS `appointments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `appointments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `appointment_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `patient_id` bigint unsigned NOT NULL,
  `doctor_id` bigint unsigned DEFAULT NULL,
  `department_id` bigint unsigned DEFAULT NULL,
  `appointment_date` date NOT NULL,
  `appointment_time` time NOT NULL,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('scheduled','completed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'scheduled',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `recurrence_rule` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `appointment_id` (`appointment_id`),
  KEY `patient_id` (`patient_id`),
  KEY `doctor_id` (`doctor_id`),
  KEY `department_id` (`department_id`),
  KEY `idx_appointment_id` (`appointment_id`),
  KEY `idx_date` (`appointment_date`),
  KEY `idx_status` (`status`),
  CONSTRAINT `appointments_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `appointments_ibfk_2` FOREIGN KEY (`doctor_id`) REFERENCES `staff` (`id`) ON DELETE SET NULL,
  CONSTRAINT `appointments_ibfk_3` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `appointments`
--

LOCK TABLES `appointments` WRITE;
/*!40000 ALTER TABLE `appointments` DISABLE KEYS */;
INSERT INTO `appointments` VALUES (1,'APP-001',1,1,1,'2025-11-19','10:00:00','Consultation','scheduled',NULL,'2025-11-18 06:46:30','2025-11-18 06:46:30',NULL);
/*!40000 ALTER TABLE `appointments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `module` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_id` bigint unsigned DEFAULT NULL,
  `old_value` text COLLATE utf8mb4_unicode_ci,
  `new_value` text COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_module` (`module`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,1,'CREATE','users',1,NULL,'Super Admin user created',NULL,NULL,'2025-11-18 06:46:30'),(2,2,'CREATE','users',2,NULL,'Admin user created',NULL,NULL,'2025-11-18 06:46:30');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `departments`
--

DROP TABLE IF EXISTS `departments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `departments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `hospital_id` bigint unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `head_of_department` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `staff_count` int DEFAULT '0',
  `beds` int DEFAULT '0',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `hospital_id` (`hospital_id`),
  CONSTRAINT `departments_ibfk_1` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `departments`
--

LOCK TABLES `departments` WRITE;
/*!40000 ALTER TABLE `departments` DISABLE KEYS */;
INSERT INTO `departments` VALUES (1,1,'Cardiology','Dr. Heart',0,0,'active','2025-11-18 06:46:30','2025-11-18 06:46:30'),(2,1,'Orthopedics','Dr. Bones',0,0,'active','2025-11-18 06:46:30','2025-11-18 06:46:30');
/*!40000 ALTER TABLE `departments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `document_tags`
--

DROP TABLE IF EXISTS `document_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `document_tags` (
  `document_id` bigint unsigned NOT NULL,
  `tag_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`document_id`,`tag_id`),
  KEY `tag_id` (`tag_id`),
  CONSTRAINT `document_tags_ibfk_1` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `document_tags_ibfk_2` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `document_tags`
--

LOCK TABLES `document_tags` WRITE;
/*!40000 ALTER TABLE `document_tags` DISABLE KEYS */;
/*!40000 ALTER TABLE `document_tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `documents`
--

DROP TABLE IF EXISTS `documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `documents` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `patient_id` bigint unsigned DEFAULT NULL,
  `document_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `document_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` enum('medical_record','lab_report','prescription','administrative') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_size` bigint DEFAULT NULL,
  `storage_type` enum('local','cloud') COLLATE utf8mb4_unicode_ci DEFAULT 'local',
  `uploaded_by` bigint unsigned DEFAULT NULL,
  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `document_id` (`document_id`),
  KEY `patient_id` (`patient_id`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `idx_document_id` (`document_id`),
  KEY `idx_category` (`category`),
  CONSTRAINT `documents_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE SET NULL,
  CONSTRAINT `documents_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `documents`
--

LOCK TABLES `documents` WRITE;
/*!40000 ALTER TABLE `documents` DISABLE KEYS */;
INSERT INTO `documents` VALUES (1,1,'Lab Report','DOC-001','Blood Test Results','pdf','lab_report',NULL,NULL,'local',2,'2025-11-18 07:46:30');
/*!40000 ALTER TABLE `documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `expenses`
--

DROP TABLE IF EXISTS `expenses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expenses` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `expense_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vendor` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date` date NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `expense_id` (`expense_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_expense_id` (`expense_id`),
  KEY `idx_category` (`category`),
  CONSTRAINT `expenses_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenses`
--

LOCK TABLES `expenses` WRITE;
/*!40000 ALTER TABLE `expenses` DISABLE KEYS */;
/*!40000 ALTER TABLE `expenses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `forecasts`
--

DROP TABLE IF EXISTS `forecasts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `forecasts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `metric` enum('income','expense','cash_flow') COLLATE utf8mb4_unicode_ci NOT NULL,
  `period_start` date NOT NULL,
  `period_end` date NOT NULL,
  `predicted_value` decimal(15,2) NOT NULL,
  `model` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `generated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `forecasts`
--

LOCK TABLES `forecasts` WRITE;
/*!40000 ALTER TABLE `forecasts` DISABLE KEYS */;
/*!40000 ALTER TABLE `forecasts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `hospitals`
--

DROP TABLE IF EXISTS `hospitals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hospitals` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `hospital_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `departments` int DEFAULT '0',
  `staff_count` int DEFAULT '0',
  `beds` int DEFAULT '0',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `hospital_id` (`hospital_id`),
  KEY `idx_hospital_id` (`hospital_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `hospitals`
--

LOCK TABLES `hospitals` WRITE;
/*!40000 ALTER TABLE `hospitals` DISABLE KEYS */;
INSERT INTO `hospitals` VALUES (1,'HOSP-001','General Hospital','123 Main St, Anytown, USA','555-1234','contact@generalhospital.com',0,0,0,'active','2025-11-18 06:46:30','2025-11-18 06:46:30');
/*!40000 ALTER TABLE `hospitals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoice_items`
--

DROP TABLE IF EXISTS `invoice_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `invoice_id` bigint unsigned NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `qty` int NOT NULL,
  `unit_price` decimal(15,2) NOT NULL,
  `tax_rate` decimal(5,2) DEFAULT '0.00',
  `total` decimal(15,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `invoice_id` (`invoice_id`),
  CONSTRAINT `invoice_items_ibfk_1` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoice_items`
--

LOCK TABLES `invoice_items` WRITE;
/*!40000 ALTER TABLE `invoice_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `invoice_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoices`
--

DROP TABLE IF EXISTS `invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoices` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `invoice_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `patient_id` bigint unsigned DEFAULT NULL,
  `date` date NOT NULL,
  `due_date` date DEFAULT NULL,
  `status` enum('draft','finalized','paid','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  `total_amount` decimal(15,2) DEFAULT '0.00',
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoice_id` (`invoice_id`),
  KEY `patient_id` (`patient_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_invoice_id` (`invoice_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `invoices_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE SET NULL,
  CONSTRAINT `invoices_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoices`
--

LOCK TABLES `invoices` WRITE;
/*!40000 ALTER TABLE `invoices` DISABLE KEYS */;
/*!40000 ALTER TABLE `invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `medical_history`
--

DROP TABLE IF EXISTS `medical_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `medical_history` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `patient_id` bigint unsigned NOT NULL,
  `condition_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `diagnosis_date` date DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `patient_id` (`patient_id`),
  CONSTRAINT `medical_history_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `medical_history`
--

LOCK TABLES `medical_history` WRITE;
/*!40000 ALTER TABLE `medical_history` DISABLE KEYS */;
INSERT INTO `medical_history` VALUES (1,1,'Hypertension','2020-05-10','Managed with medication.','2025-11-18 06:46:30');
/*!40000 ALTER TABLE `medical_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `medicine_batches`
--

DROP TABLE IF EXISTS `medicine_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `medicine_batches` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `medicine_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiry_date` date NOT NULL,
  `quantity` int DEFAULT '0',
  `recalled` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `medicine_id` (`medicine_id`),
  CONSTRAINT `medicine_batches_ibfk_1` FOREIGN KEY (`medicine_id`) REFERENCES `medicines_inventory` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `medicine_batches`
--

LOCK TABLES `medicine_batches` WRITE;
/*!40000 ALTER TABLE `medicine_batches` DISABLE KEYS */;
/*!40000 ALTER TABLE `medicine_batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `medicines`
--

DROP TABLE IF EXISTS `medicines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `medicines` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `medicine_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stock` int DEFAULT '0',
  `min_stock` int DEFAULT '0',
  `price` decimal(10,2) DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `supplier` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('in_stock','low_stock','out_of_stock') COLLATE utf8mb4_unicode_ci DEFAULT 'in_stock',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `medicine_id` (`medicine_id`),
  KEY `idx_medicine_id` (`medicine_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `medicines`
--

LOCK TABLES `medicines` WRITE;
/*!40000 ALTER TABLE `medicines` DISABLE KEYS */;
INSERT INTO `medicines` VALUES (1,'MED-001','Paracetamol 500mg','Painkiller',1000,100,5.50,'2025-12-31','Pharma Inc.','in_stock','2025-11-18 06:46:30','2025-11-18 06:46:30');
/*!40000 ALTER TABLE `medicines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `medicines_inventory`
--

DROP TABLE IF EXISTS `medicines_inventory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `medicines_inventory` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `medicine_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `supplier` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stock_level` int DEFAULT '0',
  `low_stock_threshold` int DEFAULT '0',
  `unit_price` decimal(10,2) DEFAULT '0.00',
  `expiry_date` date DEFAULT NULL,
  `storage_location` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `medicines_inventory`
--

LOCK TABLES `medicines_inventory` WRITE;
/*!40000 ALTER TABLE `medicines_inventory` DISABLE KEYS */;
/*!40000 ALTER TABLE `medicines_inventory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `patients`
--

DROP TABLE IF EXISTS `patients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `patients` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `patient_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `age` int DEFAULT NULL,
  `gender` enum('male','female','other') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `hospital_id` bigint unsigned DEFAULT NULL,
  `last_visit` date DEFAULT NULL,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `patient_id` (`patient_id`),
  KEY `idx_patient_id` (`patient_id`),
  KEY `idx_status` (`status`),
  KEY `hospital_id` (`hospital_id`),
  CONSTRAINT `patients_ibfk_1` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `patients`
--

LOCK TABLES `patients` WRITE;
/*!40000 ALTER TABLE `patients` DISABLE KEYS */;
INSERT INTO `patients` VALUES (1,'PAT-001','John','Doe',45,'male','555-8765','patient@smarthealth.com','456 Oak Ave, Anytown, USA',1,'2023-10-26','active','2025-11-18 06:46:30','2025-11-18 06:46:30');
/*!40000 ALTER TABLE `patients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `payment_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoice_id` bigint unsigned DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL,
  `method` enum('cash','card','bank','other') COLLATE utf8mb4_unicode_ci DEFAULT 'other',
  `date` date NOT NULL,
  `reference` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `payment_id` (`payment_id`),
  KEY `invoice_id` (`invoice_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_payment_id` (`payment_id`),
  CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL,
  CONSTRAINT `payments_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payroll`
--

DROP TABLE IF EXISTS `payroll`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payroll` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `payroll_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `staff_id` bigint unsigned NOT NULL,
  `period_start` date NOT NULL,
  `period_end` date NOT NULL,
  `gross_amount` decimal(15,2) NOT NULL,
  `deductions` decimal(15,2) DEFAULT '0.00',
  `net_amount` decimal(15,2) NOT NULL,
  `status` enum('processed','pending') COLLATE utf8mb4_unicode_ci DEFAULT 'processed',
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `payroll_id` (`payroll_id`),
  KEY `staff_id` (`staff_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `payroll_ibfk_1` FOREIGN KEY (`staff_id`) REFERENCES `staff` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payroll_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payroll`
--

LOCK TABLES `payroll` WRITE;
/*!40000 ALTER TABLE `payroll` DISABLE KEYS */;
/*!40000 ALTER TABLE `payroll` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `role_id` bigint unsigned NOT NULL,
  `module` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `can_view` tinyint(1) DEFAULT '0',
  `can_add` tinyint(1) DEFAULT '0',
  `can_edit` tinyint(1) DEFAULT '0',
  `can_delete` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_role_module` (`role_id`,`module`),
  CONSTRAINT `permissions_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permissions`
--

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES (1,1,'all',1,1,1,1),(2,2,'users',1,1,1,1),(3,2,'roles',1,1,1,1),(4,2,'hospitals',1,1,1,1),(5,2,'patients',1,1,1,1),(6,2,'appointments',1,1,1,1),(7,2,'finance',1,1,1,1),(8,2,'financial',1,1,1,1),(9,2,'settings',1,1,1,1),(10,3,'patients',1,1,1,0),(11,3,'appointments',1,1,1,0),(12,3,'medical_history',1,1,1,0),(13,4,'appointments',1,1,0,0),(14,4,'medical_history',1,0,0,0);
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `prescriptions`
--

DROP TABLE IF EXISTS `prescriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `prescriptions` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `patient_id` bigint unsigned NOT NULL,
  `doctor_id` bigint unsigned DEFAULT NULL,
  `medicine_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dose` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `frequency` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` int DEFAULT '0',
  `status` enum('new','dispensed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'new',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `patient_id` (`patient_id`),
  KEY `doctor_id` (`doctor_id`),
  KEY `medicine_id` (`medicine_id`),
  CONSTRAINT `prescriptions_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `prescriptions_ibfk_2` FOREIGN KEY (`doctor_id`) REFERENCES `staff` (`id`) ON DELETE SET NULL,
  CONSTRAINT `prescriptions_ibfk_3` FOREIGN KEY (`medicine_id`) REFERENCES `medicines_inventory` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `prescriptions`
--

LOCK TABLES `prescriptions` WRITE;
/*!40000 ALTER TABLE `prescriptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `prescriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_orders`
--

DROP TABLE IF EXISTS `purchase_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_orders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `supplier_id` bigint unsigned NOT NULL,
  `order_date` date NOT NULL,
  `expected_delivery_date` date DEFAULT NULL,
  `status` enum('pending','ordered','shipped','delivered','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `total_amount` decimal(15,2) DEFAULT '0.00',
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_id` (`order_id`),
  KEY `supplier_id` (`supplier_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `purchase_orders_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `purchase_orders_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_orders`
--

LOCK TABLES `purchase_orders` WRITE;
/*!40000 ALTER TABLE `purchase_orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `user_count` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'super_admin','Super Administrator with ultimate control',0,'2025-11-18 06:46:30','2025-11-18 06:46:30'),(2,'admin','Administrator with full access',0,'2025-11-18 06:46:30','2025-11-18 06:46:30'),(3,'doctor','Medical doctor with access to patient data',0,'2025-11-18 06:46:30','2025-11-18 06:46:30'),(4,'patient','Patient with access to their own data',0,'2025-11-18 06:46:30','2025-11-18 06:46:30');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sequelizemeta`
--

DROP TABLE IF EXISTS `sequelizemeta`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sequelizemeta` (
  `name` varchar(255) COLLATE utf8mb3_unicode_ci NOT NULL,
  PRIMARY KEY (`name`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sequelizemeta`
--

LOCK TABLES `sequelizemeta` WRITE;
/*!40000 ALTER TABLE `sequelizemeta` DISABLE KEYS */;
INSERT INTO `sequelizemeta` VALUES ('20251109124823-add_recurrence_rule_to_appointments.js'),('20251110120000-add_tags_and_document_tags_tables.js'),('20251117120000-add_password_enforcement_fields.js');
/*!40000 ALTER TABLE `sequelizemeta` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `settings`
--

DROP TABLE IF EXISTS `settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `settings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` text COLLATE utf8mb4_unicode_ci,
  `category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`),
  KEY `updated_by` (`updated_by`),
  CONSTRAINT `settings_ibfk_1` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `settings`
--

LOCK TABLES `settings` WRITE;
/*!40000 ALTER TABLE `settings` DISABLE KEYS */;
INSERT INTO `settings` VALUES (1,'system_name','Smart Health Manager','general',2,'2025-11-18 06:46:30'),(2,'default_language','en','localization',2,'2025-11-18 06:46:30'),(3,'patient_portal_enabled','true','features',2,'2025-11-18 06:46:30'),(4,'systemName','New System Name',NULL,NULL,'2025-11-19 00:07:54'),(5,'darkMode','true',NULL,NULL,'2025-11-19 00:07:54');
/*!40000 ALTER TABLE `settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `staff`
--

DROP TABLE IF EXISTS `staff`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `staff` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `staff_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `first_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `department_id` bigint unsigned DEFAULT NULL,
  `hospital_id` bigint unsigned DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `join_date` date DEFAULT NULL,
  `status` enum('active','on_leave','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `staff_id` (`staff_id`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `department_id` (`department_id`),
  KEY `hospital_id` (`hospital_id`),
  KEY `idx_staff_id` (`staff_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `staff_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `staff_ibfk_2` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `staff_ibfk_3` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `staff`
--

LOCK TABLES `staff` WRITE;
/*!40000 ALTER TABLE `staff` DISABLE KEYS */;
INSERT INTO `staff` VALUES (1,'STAFF-001',3,'John','Smith','Doctor',1,1,'doctor@smarthealth.com','555-5678','2022-01-15','active','2025-11-18 06:46:30','2025-11-18 06:46:30');
/*!40000 ALTER TABLE `staff` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `super_admin_settings`
--

DROP TABLE IF EXISTS `super_admin_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `super_admin_settings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` text COLLATE utf8mb4_unicode_ci,
  `category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`),
  KEY `updated_by` (`updated_by`),
  CONSTRAINT `super_admin_settings_ibfk_1` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `super_admin_settings`
--

LOCK TABLES `super_admin_settings` WRITE;
/*!40000 ALTER TABLE `super_admin_settings` DISABLE KEYS */;
INSERT INTO `super_admin_settings` VALUES (1,'maintenance_mode','false','system',1,'2025-11-18 06:46:30');
/*!40000 ALTER TABLE `super_admin_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `suppliers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_person` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `suppliers`
--

LOCK TABLES `suppliers` WRITE;
/*!40000 ALTER TABLE `suppliers` DISABLE KEYS */;
/*!40000 ALTER TABLE `suppliers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tags`
--

DROP TABLE IF EXISTS `tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tags` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tags`
--

LOCK TABLES `tags` WRITE;
/*!40000 ALTER TABLE `tags` DISABLE KEYS */;
/*!40000 ALTER TABLE `tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tax_rules`
--

DROP TABLE IF EXISTS `tax_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tax_rules` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rate` decimal(5,2) NOT NULL,
  `applies_to` enum('income','invoice','payroll','expense') COLLATE utf8mb4_unicode_ci NOT NULL,
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tax_rules`
--

LOCK TABLES `tax_rules` WRITE;
/*!40000 ALTER TABLE `tax_rules` DISABLE KEYS */;
/*!40000 ALTER TABLE `tax_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transactions`
--

DROP TABLE IF EXISTS `transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transactions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `transaction_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `date` date NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `account_id` bigint unsigned NOT NULL,
  `debit` decimal(15,2) DEFAULT '0.00',
  `credit` decimal(15,2) DEFAULT '0.00',
  `balance` decimal(15,2) DEFAULT '0.00',
  `reference` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `transaction_id` (`transaction_id`),
  KEY `account_id` (`account_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_transaction_id` (`transaction_id`),
  KEY `idx_date` (`date`),
  CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `transactions_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=178 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transactions`
--

LOCK TABLES `transactions` WRITE;
/*!40000 ALTER TABLE `transactions` DISABLE KEYS */;
INSERT INTO `transactions` VALUES (1,'TRN-001','2025-11-18','Initial capital injection',1,50000.00,0.00,0.00,NULL,NULL,'2025-11-18 06:46:30'),(2,'TRN-237ad1e7','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 06:52:46'),(3,'TRN-50e7e5c5','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 06:52:46'),(4,'TRN-48c501d3','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 06:52:47'),(5,'TRN-b24f3c4b','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 06:53:03'),(6,'TRN-c66baff8','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 06:53:03'),(7,'TRN-538e078d','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 06:53:04'),(8,'TRN-805e411d','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 06:53:09'),(9,'TRN-e57173d4','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 06:53:49'),(10,'TRN-d404625f','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 06:54:14'),(11,'TRN-5341b010','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 06:54:58'),(12,'TRN-f51924c6','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 06:55:40'),(13,'TRN-0528557f','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 06:55:47'),(14,'TRN-0c0acce3','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 06:56:03'),(15,'TRN-d9df3b80','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 06:56:08'),(16,'TRN-4bd15fdf','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 06:56:28'),(17,'TRN-0e652b7b','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 06:56:30'),(18,'TRN-e60a55f5','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 07:02:11'),(19,'TRN-d0ee04fa','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 07:25:09'),(20,'TRN-f66a8219','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 07:25:10'),(21,'TRN-5af590bf','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 07:27:13'),(22,'TRN-46d2207d','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 07:28:06'),(23,'TRN-baa79658','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 07:28:11'),(24,'TRN-1cf20779','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 07:28:12'),(25,'TRN-8ae93983','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 07:28:29'),(26,'TRN-ea7c8ab1','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 07:28:29'),(27,'TRN-e4bfeb1a','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 07:28:30'),(28,'TRN-d19a82a9','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 07:28:31'),(29,'TRN-e22799d8','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 07:28:38'),(30,'TRN-af58b83d','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 07:28:57'),(31,'TRN-9bf04979','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 07:28:57'),(32,'TRN-4b6b7b99','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 07:29:07'),(33,'TRN-d2ef6bfd','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 07:29:20'),(34,'TRN-437d5261','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 07:29:21'),(35,'TRN-ca295757','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 07:29:28'),(36,'TRN-0ae8863e','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 07:29:53'),(37,'TRN-14625fbd','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 07:29:59'),(38,'TRN-87865954','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 07:32:10'),(39,'TRN-15b7bb6a','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 18:28:33'),(40,'TRN-998355d1','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 18:28:35'),(41,'TRN-e6e1e495','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 18:28:37'),(42,'TRN-24950593','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 18:28:37'),(43,'TRN-555158c4','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 18:28:43'),(44,'TRN-0033a7bc','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 18:28:44'),(45,'TRN-b7f49e48','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 18:28:44'),(46,'TRN-3a66b89a','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 18:34:24'),(47,'TRN-18186db4','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 18:34:28'),(48,'TRN-4e7d2ea5','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 21:00:24'),(49,'TRN-8f904e04','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 23:31:46'),(50,'TRN-f60839e8','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 23:31:48'),(51,'TRN-fcd87ac4','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 23:33:45'),(52,'TRN-48c7e664','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 23:37:48'),(53,'TRN-2f90ebeb','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-18 23:37:50'),(54,'TRN-ef43d85f','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 00:08:03'),(55,'TRN-ecc6c6d0','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 00:33:03'),(56,'TRN-2dbeced2','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 01:03:23'),(57,'TRN-734a9ba9','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 01:33:53'),(58,'TRN-f282c461','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 02:04:20'),(59,'TRN-ef029232','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 06:35:01'),(60,'TRN-6b0048a5','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 07:07:14'),(61,'TRN-ab870f5f','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 07:38:10'),(62,'TRN-ae12fde7','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 18:36:23'),(63,'TRN-73618e01','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 20:30:15'),(64,'TRN-c6ed7878','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 20:30:16'),(65,'TRN-c3281a61','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 20:31:50'),(66,'TRN-a78e88aa','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 20:42:52'),(67,'TRN-4736bf9f','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 20:44:19'),(68,'TRN-4fcdfedb','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 20:47:39'),(69,'TRN-2c37478e','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 20:52:52'),(70,'TRN-31be1205','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 20:52:53'),(71,'TRN-c50c85f1','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 21:02:30'),(72,'TRN-a7c337f9','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 21:02:35'),(73,'TRN-ca21a6ce','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 21:05:12'),(74,'TRN-52c90a4b','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 21:05:12'),(75,'TRN-0ae5874a','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 21:13:24'),(76,'TRN-8fef04c3','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 21:13:24'),(77,'TRN-48bd43dc','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 21:14:02'),(78,'TRN-69fd3362','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 21:14:02'),(79,'TRN-4aa90357','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 21:18:04'),(80,'TRN-cada02f5','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 21:28:55'),(81,'TRN-76f03a95','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 21:32:16'),(82,'TRN-ced769ae','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 21:32:17'),(83,'TRN-158e0cc9','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 21:34:13'),(84,'TRN-c5cbaea4','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 21:34:15'),(85,'TRN-0473e7b8','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 21:34:32'),(86,'TRN-7ede0c74','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 21:34:32'),(87,'TRN-e9d68f60','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 21:35:08'),(88,'TRN-9c6c3a19','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 21:44:31'),(89,'TRN-04c66e15','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 21:49:55'),(90,'TRN-c2c61db1','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 21:50:14'),(91,'TRN-91151b30','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 22:20:27'),(92,'TRN-7221b941','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 22:20:28'),(93,'TRN-a6f107c5','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 22:21:02'),(94,'TRN-ca388f98','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 22:21:05'),(95,'TRN-34ec624c','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 22:39:54'),(96,'TRN-ffebaa1a','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 22:39:56'),(97,'TRN-1acc49eb','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 22:41:22'),(98,'TRN-d2af2f2b','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 22:42:52'),(99,'TRN-a9bf919d','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 22:42:55'),(100,'TRN-95e98f92','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 22:44:48'),(101,'TRN-35004ddf','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 22:48:42'),(102,'TRN-d2afef79','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 22:54:11'),(103,'TRN-694cd568','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 22:54:24'),(104,'TRN-4591a169','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 23:08:16'),(105,'TRN-5ee63e76','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 23:14:59'),(106,'TRN-e0d913ac','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 23:24:38'),(107,'TRN-13fefcd6','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 23:29:52'),(108,'TRN-32e634ed','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 23:30:05'),(109,'TRN-9c5c1a73','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 23:30:09'),(110,'TRN-439f3544','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 23:30:34'),(111,'TRN-5756c0ae','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 23:33:08'),(112,'TRN-b9310584','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 23:33:09'),(113,'TRN-25f082cf','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 23:35:06'),(114,'TRN-4ddd8067','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 23:57:15'),(115,'TRN-04195e92','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-19 23:57:16'),(116,'TRN-e2e7c2f4','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-20 00:35:55'),(117,'TRN-366e7f3b','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-20 00:36:28'),(118,'TRN-e23d93bc','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-21 19:57:33'),(119,'TRN-f77c8201','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-21 20:43:48'),(120,'TRN-0fe04c5f','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-21 20:43:49'),(121,'TRN-27c3df77','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-21 21:07:01'),(122,'TRN-53623a1a','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-21 21:22:51'),(123,'TRN-7b4cba3c','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-21 22:07:26'),(124,'TRN-0f39fb8c','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-21 22:14:42'),(125,'TRN-12cd1b05','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-21 22:28:52'),(126,'TRN-8a5f241e','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-21 22:34:17'),(127,'TRN-5bae659d','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-21 22:40:05'),(128,'TRN-11d9d283','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-21 23:37:13'),(129,'TRN-7143af88','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 00:04:13'),(130,'TRN-f217d898','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 00:27:28'),(131,'TRN-49ceef0b','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 00:32:09'),(132,'TRN-4743054b','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 00:39:31'),(133,'TRN-81129a8e','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 00:44:23'),(134,'TRN-64a3261d','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 01:04:32'),(135,'TRN-6b529108','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 01:29:16'),(136,'TRN-5422c993','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 01:29:21'),(137,'TRN-ed440c40','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 01:31:11'),(138,'TRN-fba5c37c','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 01:34:06'),(139,'TRN-3ffa3eba','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 14:09:30'),(140,'TRN-6daddf23','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 14:40:48'),(141,'TRN-2f2fee65','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 15:13:23'),(142,'TRN-9eef45ae','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 15:13:27'),(143,'TRN-ac91240c','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 16:52:12'),(144,'TRN-62b1f7e8','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 16:54:06'),(145,'TRN-dffbe66d','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 17:24:19'),(146,'TRN-681b34c7','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 17:54:35'),(147,'TRN-3b6f7694','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 18:24:59'),(148,'TRN-2aa489eb','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 18:59:17'),(149,'TRN-3dbcdb52','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 19:44:19'),(150,'TRN-b2298af4','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 19:44:38'),(151,'TRN-768e34d5','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 19:57:44'),(152,'TRN-5591cccd','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 20:17:54'),(153,'TRN-2724eb05','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 20:51:42'),(154,'TRN-00a46e2d','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 21:22:08'),(155,'TRN-92d1cf93','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 21:52:29'),(156,'TRN-fcfc14da','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-22 22:23:13'),(157,'TRN-7c8d051d','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-23 02:00:46'),(158,'TRN-646d5899','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-23 02:05:17'),(159,'TRN-14ae8a65','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-23 02:09:08'),(160,'TRN-ae55c218','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-23 13:27:00'),(161,'TRN-f3685d79','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-23 13:27:13'),(162,'TRN-2c6f1f9c','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-23 13:29:56'),(163,'TRN-fad6959d','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-23 13:40:17'),(164,'TRN-3d7e57f1','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-23 14:44:10'),(165,'TRN-975d8d84','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-23 15:59:49'),(166,'TRN-457c3df9','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-23 16:01:25'),(167,'TRN-1428ca5c','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-23 16:15:12'),(168,'TRN-fc15ec84','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-23 18:15:02'),(169,'TRN-439ad5de','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-23 18:15:32'),(170,'TRN-fd53437e','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-23 18:16:32'),(171,'TRN-d1f46242','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-23 18:18:11'),(172,'TRN-d1e42cb8','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-23 18:18:53'),(173,'TRN-11aa1caf','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-23 18:20:22'),(174,'TRN-861928a3','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-23 18:50:39'),(175,'TRN-e4947ce7','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-23 19:30:05'),(176,'TRN-b6a5adba','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-23 21:54:31'),(177,'TRN-b0698b8e','2025-01-01','Test',3,0.00,100.00,0.00,NULL,2,'2025-11-23 21:56:10');
/*!40000 ALTER TABLE `transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `role_id` bigint unsigned DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','inactive','locked') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `login_attempts` int DEFAULT '0',
  `locked_until` datetime DEFAULT NULL,
  `last_login` datetime DEFAULT NULL,
  `password_must_change` tinyint(1) DEFAULT '0',
  `password_changed_at` datetime DEFAULT NULL,
  `password_postpone_count` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_email` (`email`),
  KEY `idx_status` (`status`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,1,'superadmin@smarthealth.com','$2b$10$E.hpsa45a/S3Y8ifp9Sgpeo2n.VLzN2a9g2aRtDI1o0p4v.B5R/cK','Super Admin','active',0,NULL,NULL,0,NULL,0,'2025-11-18 06:46:30','2025-11-18 06:46:30'),(2,2,'admin@smarthealth.com','$2b$10$E.hpsa45a/S3Y8ifp9Sgpeo2n.VLzN2a9g2aRtDI1o0p4v.B5R/cK','Admin User','active',0,NULL,NULL,0,NULL,0,'2025-11-18 06:46:30','2025-11-18 06:46:30'),(3,3,'doctor@smarthealth.com','$2b$10$E.hpsa45a/S3Y8ifp9Sgpeo2n.VLzN2a9g2aRtDI1o0p4v.B5R/cK','Dr. Smith','active',0,NULL,NULL,0,NULL,0,'2025-11-18 06:46:30','2025-11-18 06:46:30'),(4,4,'patient@smarthealth.com','$2b$10$E.hpsa45a/S3Y8ifp9Sgpeo2n.VLzN2a9g2aRtDI1o0p4v.B5R/cK','John Doe','active',0,NULL,NULL,0,NULL,0,'2025-11-18 06:46:30','2025-11-18 06:46:30');
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

-- Dump completed on 2025-11-24  0:00:00
