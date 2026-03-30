# Notion Integration & Database Strategy

This document outlines the proposed architecture for hooking up Secundus Dermis to Notion as a primary database.

## 1. Notion as a Backend
Notion provides a powerful API that can act as a flexible database. By using Notion, we can have a human-readable interface for managing users and monitoring sessions.

### 1.1 User Database
The user database will store identity and profile information.
- **Unique Identifier**: The **Notion Page UUID** is the stable identifier.
- **Email Change Support**: The `Email` property is just a searchable field.
- **Table Name**: `Users`
- **Properties**:
  - `UserID` (Title): Stores the Notion Page UUID.
  - `Email` (Email): User's current email address.
  - `Name` (Text): User's full name.
  - `PasswordHash` (Text): Securely hashed password.
  - `CreatedAt` (Date): Timestamp of account creation.
  - `LastLogin` (Date): Timestamp of most recent activity.

### 1.2 Session Database
Sessions will be persisted in Notion and linked to users via their stable UUIDs.
- **Unique Identifier**: The **SessionID** will correspond to the **Notion Page UUID**.
- **Table Name**: `Sessions`
- **Properties**:
  - `SessionID` (Title): Stores the Notion Page UUID.
  - `User` (Relation): Link to the `Users` database entry.
  - `Status` (Select): `Active` or `Expired`.
  - `CreatedAt` (Date): Timestamp of session start.
  - `ExpiresAt` (Date): When the session expires.

## 2. Session Management Policy
- **No Deletion**: Sessions must **never be deleted** from the database.
- **Mark as Expired**: Update `Status` to `Expired` instead of removing records.
- **Data Integrity**: Ensures a complete audit trail.

## 3. Page & Content Persistence
- **No Page Deletion**: No journal entries or system pages should be removed.
- **Soft Archiving**: Use "Hidden" or "Archived" status instead of deletion.

## 4. Implementation Details
1. **Email Updates**: Updating `Email` property doesn't break relations since they use stable Page UUIDs.
2. **UUID Mapping**: The backend maps internal objects to Notion Page IDs.
