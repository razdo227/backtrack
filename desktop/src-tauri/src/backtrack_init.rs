use sha2::{Digest, Sha256};
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const BACKTRACK_DIR_NAME: &str = ".backtrack";
const INIT_FILE_NAME: &str = "project.bt";
const MAGIC: [u8; 4] = *b"BTK1";
const VERSION: u8 = 1;

#[derive(Debug, Clone)]
pub struct BacktrackInitV1 {
    pub project_id: [u8; 16],
    pub created_ms: i64,
    pub updated_ms: i64,
    pub flags: u8,
}

pub fn init_file_path(project_root: &Path) -> PathBuf {
    project_root.join(BACKTRACK_DIR_NAME).join(INIT_FILE_NAME)
}

pub fn has_init_file(project_root: &Path) -> bool {
    init_file_path(project_root).is_file()
}

pub fn ensure_init_file(project_root: &Path) -> io::Result<bool> {
    let init_path = init_file_path(project_root);
    if init_path.is_file() {
        match read_init_file(project_root) {
            Ok(_) => return Ok(false),
            Err(e) if e.kind() == io::ErrorKind::InvalidData => {
                // Corrupt/unknown init file: rewrite to a fresh v1.
            }
            Err(e) => return Err(e),
        }
    }

    let now_ms = now_epoch_ms().unwrap_or(0);
    let init = BacktrackInitV1 {
        project_id: generate_project_id(project_root),
        created_ms: now_ms,
        updated_ms: now_ms,
        flags: 0,
    };

    write_init_file_atomic(project_root, &init)?;
    Ok(true)
}

pub fn read_init_file(project_root: &Path) -> io::Result<BacktrackInitV1> {
    let bytes = fs::read(init_file_path(project_root))?;
    parse_init_bytes(&bytes)
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "Invalid .backtrack init file"))
}

pub fn remove_backtrack_dir(project_root: &Path) -> io::Result<bool> {
    let dir = project_root.join(BACKTRACK_DIR_NAME);
    if !dir.exists() {
        return Ok(false);
    }
    fs::remove_dir_all(dir)?;
    Ok(true)
}

fn now_epoch_ms() -> Option<i64> {
    let duration = SystemTime::now().duration_since(UNIX_EPOCH).ok()?;
    duration.as_millis().try_into().ok()
}

fn generate_project_id(project_root: &Path) -> [u8; 16] {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();

    let mut hasher = Sha256::new();
    hasher.update(now.as_nanos().to_le_bytes());
    hasher.update(std::process::id().to_le_bytes());
    hasher.update(project_root.as_os_str().to_string_lossy().as_bytes());
    let digest = hasher.finalize();

    let mut out = [0u8; 16];
    out.copy_from_slice(&digest[..16]);
    out
}

fn write_init_file_atomic(project_root: &Path, init: &BacktrackInitV1) -> io::Result<()> {
    let dir = project_root.join(BACKTRACK_DIR_NAME);
    fs::create_dir_all(&dir)?;

    let final_path = dir.join(INIT_FILE_NAME);
    let tmp_path = dir.join(format!("{}.tmp", INIT_FILE_NAME));

    let mut file = fs::File::create(&tmp_path)?;
    file.write_all(&serialize_init(init))?;
    file.sync_all()?;

    if final_path.exists() {
        fs::remove_file(&final_path)?;
    }
    fs::rename(tmp_path, final_path)?;
    Ok(())
}

fn serialize_init(init: &BacktrackInitV1) -> Vec<u8> {
    let mut out = Vec::with_capacity(38);
    out.extend_from_slice(&MAGIC);
    out.push(VERSION);
    out.extend_from_slice(&init.project_id);
    out.extend_from_slice(&init.created_ms.to_le_bytes());
    out.extend_from_slice(&init.updated_ms.to_le_bytes());
    out.push(init.flags);
    out
}

fn parse_init_bytes(bytes: &[u8]) -> Option<BacktrackInitV1> {
    if bytes.len() < 38 {
        return None;
    }

    if bytes[0..4] != MAGIC {
        return None;
    }
    if bytes[4] != VERSION {
        return None;
    }

    let mut project_id = [0u8; 16];
    project_id.copy_from_slice(&bytes[5..21]);

    let mut created_ms_bytes = [0u8; 8];
    created_ms_bytes.copy_from_slice(&bytes[21..29]);
    let created_ms = i64::from_le_bytes(created_ms_bytes);

    let mut updated_ms_bytes = [0u8; 8];
    updated_ms_bytes.copy_from_slice(&bytes[29..37]);
    let updated_ms = i64::from_le_bytes(updated_ms_bytes);

    let flags = bytes[37];

    Some(BacktrackInitV1 {
        project_id,
        created_ms,
        updated_ms,
        flags,
    })
}
