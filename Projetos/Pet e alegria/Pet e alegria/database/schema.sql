CREATE TABLE IF NOT EXISTS usuarios_admin (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(160) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  ultimo_login_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS animais (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  tipo ENUM('cachorro','gato') NOT NULL,
  raca VARCHAR(120) NOT NULL,
  idade VARCHAR(60) NOT NULL,
  sexo ENUM('macho','femea') NULL,
  porte ENUM('pequeno','medio','grande') NULL,
  vacinado TINYINT(1) NOT NULL DEFAULT 0,
  castrado TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('disponivel','adotado','indisponivel') NOT NULL DEFAULT 'disponivel',
  descricao TEXT NULL,
  imagem_url VARCHAR(1200) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_animais_status (status),
  INDEX idx_animais_tipo (tipo),
  INDEX idx_animais_porte (porte)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS solicitacoes_anuncio (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome_animal VARCHAR(120) NOT NULL,
  tipo ENUM('cachorro','gato') NOT NULL,
  raca VARCHAR(120) NULL,
  idade VARCHAR(60) NOT NULL,
  sexo ENUM('macho','femea') NULL,
  porte ENUM('pequeno','medio','grande') NULL,
  descricao TEXT NULL,
  responsavel VARCHAR(160) NOT NULL,
  telefone VARCHAR(40) NOT NULL,
  email VARCHAR(180) NULL,
  imagem_url VARCHAR(1200) NULL,
  status ENUM('pendente','aprovada','recusada') NOT NULL DEFAULT 'pendente',
  animal_id_criado INT UNSIGNED NULL,
  analisada_por_admin_id INT UNSIGNED NULL,
  analisada_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_solicitacoes_status (status),
  CONSTRAINT fk_solicitacao_animal FOREIGN KEY (animal_id_criado) REFERENCES animais(id) ON DELETE SET NULL,
  CONSTRAINT fk_solicitacao_admin FOREIGN KEY (analisada_por_admin_id) REFERENCES usuarios_admin(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS interesses_adocao (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  animal_id INT UNSIGNED NULL,
  animal_nome VARCHAR(120) NOT NULL,
  nome VARCHAR(160) NOT NULL,
  telefone VARCHAR(40) NOT NULL,
  email VARCHAR(180) NULL,
  mensagem TEXT NULL,
  status ENUM('novo','em_contato','concluido','arquivado') NOT NULL DEFAULT 'novo',
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_interesses_animal (animal_id),
  INDEX idx_interesses_status (status),
  CONSTRAINT fk_interesse_animal FOREIGN KEY (animal_id) REFERENCES animais(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessoes_admin (
  session_id VARCHAR(128) PRIMARY KEY,
  expires_at DATETIME NOT NULL,
  data LONGTEXT NOT NULL,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sessoes_expira (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS logs_admin (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id INT UNSIGNED NULL,
  acao VARCHAR(100) NOT NULL,
  detalhes TEXT NULL,
  ip VARCHAR(64) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_logs_admin (admin_id),
  INDEX idx_logs_data (criado_em),
  CONSTRAINT fk_logs_admin FOREIGN KEY (admin_id) REFERENCES usuarios_admin(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
