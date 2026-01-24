-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema database_kassa
-- -----------------------------------------------------

-- -----------------------------------------------------
-- Schema database_kassa
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `database_kassa` DEFAULT CHARACTER SET utf8 ;
USE `database_kassa` ;

-- -----------------------------------------------------
-- Table `database_kassa`.`users`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `database_kassa`.`users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `firstname` VARCHAR(45) NOT NULL,
  `lastname` VARCHAR(45) NOT NULL,
  `username` VARCHAR(45) NOT NULL,
  `email` VARCHAR(45) NULL,
  `telephone` VARCHAR(45) NULL,
  `password` VARCHAR(100) NOT NULL,
  `birthday` DATE NULL,
  `isactive` TINYINT NOT NULL DEFAULT 0,
  `isfirstlogin` TINYINT NOT NULL DEFAULT 1,
  `createdat` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedat` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdby` INT NULL,
  `updatedby` INT NULL,
  `id_father` INT NULL,
  `id_mother` INT NULL,
  `image_url` VARCHAR(255) NULL,
  `gender` VARCHAR(45) NULL,
  `contribution_tier` ENUM('LEVEL1', 'LEVEL2', 'LEVEL3', 'LEVEL4') NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_users_users1_idx` (`createdby` ASC) VISIBLE,
  INDEX `fk_users_users2_idx` (`updatedby` ASC) VISIBLE,
  INDEX `fk_users_users3_idx` (`id_father` ASC) VISIBLE,
  INDEX `fk_users_users4_idx` (`id_mother` ASC) VISIBLE,
  CONSTRAINT `fk_users_users1`
    FOREIGN KEY (`createdby`)
    REFERENCES `database_kassa`.`users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_users_users2`
    FOREIGN KEY (`updatedby`)
    REFERENCES `database_kassa`.`users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_users_users3`
    FOREIGN KEY (`id_father`)
    REFERENCES `database_kassa`.`users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_users_users4`
    FOREIGN KEY (`id_mother`)
    REFERENCES `database_kassa`.`users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `database_kassa`.`roles`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `database_kassa`.`roles` (
  `id` INT NOT NULL,
  `role` VARCHAR(20) NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `database_kassa`.`role_attribution`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `database_kassa`.`role_attribution` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `users_id` INT NOT NULL,
  `roles_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_role_attribution_users1_idx` (`users_id` ASC) VISIBLE,
  INDEX `fk_role_attribution_roles1_idx` (`roles_id` ASC) VISIBLE,
  CONSTRAINT `fk_role_attribution_users1`
    FOREIGN KEY (`users_id`)
    REFERENCES `database_kassa`.`users` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_role_attribution_roles1`
    FOREIGN KEY (`roles_id`)
    REFERENCES `database_kassa`.`roles` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `database_kassa`.`payment_methods`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `database_kassa`.`payment_methods` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(45) NOT NULL,
  `isactive` TINYINT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `type_of_proof` ENUM('TRANSACTIONNUMBER', 'LINK', 'BOTH') NOT NULL DEFAULT 'BOTH',
  `account_number` VARCHAR(45) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `updated_at_UNIQUE` (`updated_at` ASC) VISIBLE,
  UNIQUE INDEX `created_at_UNIQUE` (`created_at` ASC) VISIBLE,
  UNIQUE INDEX `name_UNIQUE` (`name` ASC) VISIBLE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `database_kassa`.`transactions`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `database_kassa`.`transactions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `amount` DECIMAL NOT NULL,
  `status` ENUM('SAVED', 'PENDING', 'PARTIALLY_APPROVED', 'VALIDATED', 'REJECTED') NOT NULL,
  `proof_reference` VARCHAR(255) NOT NULL,
  `validated_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL,
  `recorded_by_id` INT NOT NULL,
  `users_id` INT NOT NULL,
  `updated_by` INT NOT NULL,
  `payment_methods_id` INT NOT NULL,
  `transaction_type` ENUM('CONTRIBUTION', 'DONATIONS', 'EXPENSE') NOT NULL,
  `updated_at` DATETIME NOT NULL,
  `issubmitted` TINYINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `fk_transactions_users1_idx` (`recorded_by_id` ASC) VISIBLE,
  INDEX `fk_transactions_users2_idx` (`users_id` ASC) VISIBLE,
  INDEX `fk_transactions_users3_idx` (`updated_by` ASC) VISIBLE,
  INDEX `fk_transactions_payment_methods1_idx` (`payment_methods_id` ASC) VISIBLE,
  CONSTRAINT `fk_transactions_users1`
    FOREIGN KEY (`recorded_by_id`)
    REFERENCES `database_kassa`.`users` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_transactions_users2`
    FOREIGN KEY (`users_id`)
    REFERENCES `database_kassa`.`users` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_transactions_users3`
    FOREIGN KEY (`updated_by`)
    REFERENCES `database_kassa`.`users` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_transactions_payment_methods1`
    FOREIGN KEY (`payment_methods_id`)
    REFERENCES `database_kassa`.`payment_methods` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `database_kassa`.`transaction_approvals`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `database_kassa`.`transaction_approvals` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `role_at_approval` VARCHAR(45) NULL,
  `approved_at` DATETIME NULL,
  `note` TEXT NULL,
  `transactions_id` INT NOT NULL,
  `users_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_transaction_approvals_transactions1_idx` (`transactions_id` ASC) VISIBLE,
  INDEX `fk_transaction_approvals_users1_idx` (`users_id` ASC) VISIBLE,
  CONSTRAINT `fk_transaction_approvals_transactions1`
    FOREIGN KEY (`transactions_id`)
    REFERENCES `database_kassa`.`transactions` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_transaction_approvals_users1`
    FOREIGN KEY (`users_id`)
    REFERENCES `database_kassa`.`users` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `database_kassa`.`messages`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `database_kassa`.`messages` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `message` VARCHAR(225) NULL,
  `message_type` ENUM('APPROVAL', 'MESSAGE', 'EXTERNE') NULL,
  `received_at` DATETIME NOT NULL,
  `link` VARCHAR(150) NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `database_kassa`.`messages_recipients`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `database_kassa`.`messages_recipients` (
  `id` INT NOT NULL,
  `isreaded` TINYINT NOT NULL,
  `sender_id` INT NOT NULL,
  `receiver_id` INT NOT NULL,
  `messages_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_messages_recipients_users1_idx` (`sender_id` ASC) VISIBLE,
  INDEX `fk_messages_recipients_users2_idx` (`receiver_id` ASC) VISIBLE,
  INDEX `fk_messages_recipients_messages1_idx` (`messages_id` ASC) VISIBLE,
  CONSTRAINT `fk_messages_recipients_users1`
    FOREIGN KEY (`sender_id`)
    REFERENCES `database_kassa`.`users` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_messages_recipients_users2`
    FOREIGN KEY (`receiver_id`)
    REFERENCES `database_kassa`.`users` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_messages_recipients_messages1`
    FOREIGN KEY (`messages_id`)
    REFERENCES `database_kassa`.`messages` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `database_kassa`.`family_assignation`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `database_kassa`.`family_assignation` (
  `id` INT NOT NULL,
  `users_assigned_id` INT NOT NULL,
  `users_responsable_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_family_assignation_users1_idx` (`users_assigned_id` ASC) VISIBLE,
  INDEX `fk_family_assignation_users2_idx` (`users_responsable_id` ASC) VISIBLE,
  CONSTRAINT `fk_family_assignation_users1`
    FOREIGN KEY (`users_assigned_id`)
    REFERENCES `database_kassa`.`users` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_family_assignation_users2`
    FOREIGN KEY (`users_responsable_id`)
    REFERENCES `database_kassa`.`users` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
