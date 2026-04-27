# Data Persistence in IAMS Backend

This document explains how data is managed and persists across different scenarios in the IAMS system.

## 🔄 Data Persistence Overview

The IAMS backend uses **PostgreSQL** as the primary data store with **Knex.js** as the query builder and migration system. Data persistence behavior varies by operation type and user role.

## 📊 Database Persistence Rules

### **Permanent Data (Never Deleted)**
These records are never truly deleted - they use soft deletes or archival:

#### **Users & Authentication**
- **Users Table**: Core user accounts persist permanently
- **Password History**: Old password hashes retained for security audit
- **JWT Tokens**: Stateless - no persistence required
- **Login Logs**: Authentication attempts tracked for security

#### **Core Business Data**
- **Students**: Student profiles persist for academic records
- **Attachments**: Industrial attachment records for compliance
- **Reports**: Generated reports stored permanently for audit trail

### **Transactional Data (Can Be Modified/Deleted)**
These records follow business rules for modification:

#### **Daily Logs**
- **Draft Status**: Can be edited/deleted by students
- **Submitted Status**: Cannot be edited, but can be deleted by students
- **After Weekly Review**: Logs become read-only for historical integrity

#### **Weekly Reviews**
- **Pending Status**: Can be modified by admins
- **Industry Reviewed**: Can be updated by university supervisors
- **Complete Status**: Becomes read-only for audit purposes

#### **Feedback Records**
- **Industry Feedback**: Can be edited until weekly review is complete
- **University Feedback**: Can be edited by supervisors until review is complete

## 🌱 Seeded Data Behavior

### **Seed Data Persistence**
The seed data created during development **persists permanently** unless explicitly cleared:

#### **What Gets Seeded**
```javascript
// Seed files create this data:
- 6 Users (admin, supervisors, students)
- 3 Students with supervisor assignments
- 3 Active attachments with organizations
- 13 Daily logs across 2 weeks
- 3 Weekly reviews with different statuses
- 5 Industry feedback records
- 2 University feedback records
```

#### **Seed Data Characteristics**
- **Realistic Test Data**: Uses actual names, organizations, dates
- **Complete Workflows**: Demonstrates full system functionality
- **Relationship Integrity**: All foreign keys properly linked
- **Status Variety**: Shows all possible states

### **Seed Data Persistence Rules**
```javascript
// Seed files use this pattern:
exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('table_name').del();
  
  // Insert seed entries
  await knex('table_name').insert([...]);
};
```

**Important**: Running seeds **WILL DELETE** all existing data in the target tables!

## 🔒 Data Protection Mechanisms

### **Referential Integrity**
```sql
-- Foreign key constraints prevent orphaned records
ALTER TABLE daily_logs 
ADD CONSTRAINT fk_daily_logs_attachment 
FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE;
```

### **Soft Deletes (Where Implemented)**
```javascript
// Example: Soft delete for sensitive data
await db('sensitive_table')
  .where({ id })
  .update({ 
    deleted_at: new Date(),
    is_deleted: true 
  });
```

### **Audit Trails**
```javascript
// All important tables track:
- created_at  // Record creation
- updated_at  // Record modification  
- submitted_at // Status changes
- deleted_at  // Soft deletes
```

## 🚫 Data Deletion Scenarios

### **Complete Data Removal**
Only these scenarios should completely remove data:

#### **Development Environment**
```bash
# Clear all data and reseed
npm run seed  # This deletes existing data first
```

#### **Administrative Actions**
```javascript
// Student data removal (GDPR compliance)
await db('students').where('user_id', userId).del();
await db('daily_logs').where('attachment_id', studentAttachments).del();
await db('attachments').where('student_id', studentId).del();
```

#### **System Maintenance**
```javascript
// Expired token cleanup
await db('industry_feedback')
  .where('submitted_at', '<', db.raw('CURRENT_DATE - INTERVAL \'30 days\''))
  .del();
```

## 📈 Data Persistence During Operations

### **CRUD Operations**
```javascript
// CREATE - Data persists immediately
const [newRecord] = await db('table').insert(data).returning('*');

// READ - Data retrieved from database
const records = await db('table').where(conditions).select('*');

// UPDATE - Data modified in place
const [updatedRecord] = await db('table')
  .where({ id })
  .update(changes)
  .returning('*');

// DELETE - Data removed (with cascades)
await db('table').where({ id }).del();
```

### **Transaction Safety**
```javascript
// Multiple operations in single transaction
await db.transaction(async (trx) => {
  await trx('table1').insert(data1);
  await trx('table2').insert(data2);
  await trx('table3').where({ id }).update(data3);
});
```

## 🔍 Data Verification

### **Seeded Data Verification**
```javascript
// Test that seeded data exists
const userCount = await db('users').count('* as count');
console.log(`Users in DB: ${userCount[0].count}`); // Should be 6

// Test relationships work
const studentWithLogs = await db('students')
  .join('daily_logs', 'students.id', 'daily_logs.student_id')
  .where('students.reg_number', 'SCS/2021/001')
  .first();
```

### **Data Integrity Checks**
```javascript
// Verify foreign key constraints
const orphanedLogs = await db('daily_logs')
  .leftJoin('attachments', 'daily_logs.attachment_id', 'attachments.id')
  .whereNull('attachments.id')
  .count('* as count');
```

## ⚠️ Important Notes

### **Seed Data Warning**
⚠️ **Running `npm run seed` will DELETE all existing data!**

This is intentional for development but **DANGEROUS in production**.

### **Production Data Protection**
- **Never run seeds in production**
- **Use proper migration system for schema changes**
- **Implement proper backup strategies**
- **Use transaction isolation for critical operations**

### **Development Best Practices**
```javascript
// Use transactions for multi-table operations
await db.transaction(async (trx) => {
  // All related operations here
});

// Verify data after operations
const result = await db('table').where({ id }).first();
if (!result) {
  throw new Error('Operation failed - data not found');
}
```

## 🔄 Backup and Recovery

### **Development Environment**
```bash
# Export data before major changes
pg_dump -h localhost -U postgres -d iams_dev > backup.sql

# Restore if needed
psql -h localhost -U postgres -d iams_dev < backup.sql
```

### **Production Environment**
- **Automated daily backups**
- **Point-in-time recovery capability**
- **Read replica for reporting queries**
- **Archive old data periodically**

---

## 📋 Summary

- **Seeded data persists** until explicitly cleared
- **Running seeds deletes existing data** - use with caution
- **Production data is protected** through proper migration system
- **All operations maintain** audit trails and referential integrity
- **Transaction safety** ensures data consistency during complex operations

*Understanding these persistence rules is crucial for proper system administration and data management.*
