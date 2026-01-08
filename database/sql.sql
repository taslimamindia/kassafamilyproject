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
DROP TABLE IF EXISTS `database_kassa`.`users` ;

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
DROP TABLE IF EXISTS `database_kassa`.`roles` ;

CREATE TABLE IF NOT EXISTS `database_kassa`.`roles` (
  `id` INT NOT NULL,
  `role` VARCHAR(20) NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `database_kassa`.`role_attribution`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `database_kassa`.`role_attribution` ;

CREATE TABLE IF NOT EXISTS `database_kassa`.`role_attribution` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `users_id` INT NOT NULL,
  `roles_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_role_attribution_users_idx` (`users_id` ASC, `roles_id` ASC) VISIBLE,
  INDEX `fk_role_attribution_roles1_idx` (`roles_id` ASC) VISIBLE,
  UNIQUE INDEX `unique_role_index` (`users_id` ASC, `roles_id` ASC) VISIBLE,
  CONSTRAINT `fk_role_attribution_users`
    FOREIGN KEY (`users_id` , `roles_id`)
    REFERENCES `database_kassa`.`users` (`id` , `id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_role_attribution_roles1`
    FOREIGN KEY (`roles_id`)
    REFERENCES `database_kassa`.`roles` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
