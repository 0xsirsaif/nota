use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AttachmentType {
    File,
    Link,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub id: String,
    pub session_id: String,
    #[serde(rename = "type")]
    pub type_: AttachmentType,
    pub label: Option<String>,
    pub file_path: Option<String>,
    pub url: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAttachmentInput {
    pub session_id: String,
    #[serde(rename = "type")]
    pub type_: AttachmentType,
    pub label: Option<String>,
    pub file_path: Option<String>,
    pub url: Option<String>,
}
