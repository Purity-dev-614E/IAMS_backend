const db = require('../database/connection');
const { asyncHandler } = require('../middleware/errorHandler');

// Get all students (admin/supervisor)
const getAllStudents = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, program, year } = req.query;
  const offset = (page - 1) * limit;

  let query = db('students')
    .join('users', 'students.user_id', 'users.id')
    .leftJoin('users as supervisors', 'students.uni_supervisor_id', 'supervisors.id')
    .select(
      'students.id',
      'students.reg_number',
      'students.program',
      'students.year_of_study',
      'students.created_at',
      'users.id as user_id',
      'users.name as student_name',
      'users.email as student_email',
      'supervisors.name as supervisor_name',
      'supervisors.email as supervisor_email'
    )
    .orderBy('students.created_at', 'desc');

  // Apply filters
  if (search) {
    query = query.where(function() {
      this.where('users.name', 'ilike', `%${search}%`)
          .orWhere('students.reg_number', 'ilike', `%${search}%`)
          .orWhere('users.email', 'ilike', `%${search}%`);
    });
  }

  if (program) {
    query = query.where('students.program', 'ilike', `%${program}%`);
  }

  if (year) {
    query = query.where('students.year_of_study', year);
  }

  // Get total count
  const totalQuery = query.clone().clearSelect().clearOrder().count('* as total');
  const [{ total }] = await totalQuery;

  // Get paginated results
  const students = await query.limit(limit).offset(offset);

  res.json({
    success: true,
    students,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total),
      pages: Math.ceil(total / limit)
    }
  });
});

// Get student by ID
const getStudentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const student = await db('students')
    .join('users', 'students.user_id', 'users.id')
    .leftJoin('users as supervisors', 'students.uni_supervisor_id', 'supervisors.id')
    .select(
      'students.id',
      'students.reg_number',
      'students.program',
      'students.year_of_study',
      'students.uni_supervisor_id',
      'students.created_at',
      'students.updated_at',
      'users.id as user_id',
      'users.name as student_name',
      'users.email as student_email',
      'users.role as user_role',
      'supervisors.name as supervisor_name',
      'supervisors.email as supervisor_email'
    )
    .where('students.id', id)
    .first();

  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found'
    });
  }

  res.json({
    success: true,
    student
  });
});

// Create student (admin only)
const createStudent = asyncHandler(async (req, res) => {
  const { 
    user_id, 
    reg_number, 
    program, 
    year_of_study, 
    uni_supervisor_id 
  } = req.body;

  // Check if user exists and is a student
  const user = await db('users').where({ id: user_id, role: 'student' }).first();
  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'User not found or is not a student'
    });
  }

  // Check if reg_number already exists
  const existingStudent = await db('students').where({ reg_number }).first();
  if (existingStudent) {
    return res.status(409).json({
      success: false,
      message: 'Registration number already exists'
    });
  }

  // Check if supervisor exists if provided
  if (uni_supervisor_id) {
    const supervisor = await db('users')
      .where({ id: uni_supervisor_id, role: 'uni_supervisor' })
      .first();
    if (!supervisor) {
      return res.status(400).json({
        success: false,
        message: 'University supervisor not found'
      });
    }
  }

  // Create student
  const [student] = await db('students').insert({
    user_id,
    reg_number,
    program,
    year_of_study,
    uni_supervisor_id
  }).returning('*');

  res.status(201).json({
    success: true,
    message: 'Student created successfully',
    student
  });
});

// Update student (admin only)
const updateStudent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    reg_number, 
    program, 
    year_of_study, 
    uni_supervisor_id 
  } = req.body;

  // Check if student exists
  const existingStudent = await db('students').where({ id }).first();
  if (!existingStudent) {
    return res.status(404).json({
      success: false,
      message: 'Student not found'
    });
  }

  // Check reg_number uniqueness if being changed
  if (reg_number && reg_number !== existingStudent.reg_number) {
    const regCheck = await db('students')
      .where({ reg_number })
      .whereNot('id', id)
      .first();
    if (regCheck) {
      return res.status(409).json({
        success: false,
        message: 'Registration number already exists'
      });
    }
  }

  // Check supervisor if provided
  if (uni_supervisor_id && uni_supervisor_id !== existingStudent.uni_supervisor_id) {
    const supervisor = await db('users')
      .where({ id: uni_supervisor_id, role: 'uni_supervisor' })
      .first();
    if (!supervisor) {
      return res.status(400).json({
        success: false,
        message: 'University supervisor not found'
      });
    }
  }

  // Update student
  const [updatedStudent] = await db('students')
    .where({ id })
    .update({
      reg_number: reg_number || existingStudent.reg_number,
      program: program || existingStudent.program,
      year_of_study: year_of_study || existingStudent.year_of_study,
      uni_supervisor_id: uni_supervisor_id || existingStudent.uni_supervisor_id,
      updated_at: new Date()
    })
    .returning('*');

  res.json({
    success: true,
    message: 'Student updated successfully',
    student: updatedStudent
  });
});

// Assign supervisor to student
const assignSupervisor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { uni_supervisor_id } = req.body;

  // Check if student exists
  const student = await db('students').where({ id }).first();
  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student not found'
    });
  }

  // Check if supervisor exists
  const supervisor = await db('users')
    .where({ id: uni_supervisor_id, role: 'uni_supervisor' })
    .first();
  if (!supervisor) {
    return res.status(400).json({
      success: false,
      message: 'University supervisor not found'
    });
  }

  // Update student
  await db('students')
    .where({ id })
    .update({ 
      uni_supervisor_id,
      updated_at: new Date()
    });

  res.json({
    success: true,
    message: 'Supervisor assigned successfully'
  });
});

// Get students for supervisor
const getSupervisorStudents = asyncHandler(async (req, res) => {
  const supervisorId = req.user.id;

  const students = await db('students')
    .join('users', 'students.user_id', 'users.id')
    .leftJoin('attachments', 'students.id', 'attachments.student_id')
    .select(
      'students.id',
      'students.reg_number',
      'students.program',
      'students.year_of_study',
      'users.name as student_name',
      'users.email as student_email',
      db.raw('COUNT(attachments.id) as attachment_count')
    )
    .where('students.uni_supervisor_id', supervisorId)
    .groupBy('students.id', 'users.id')
    .orderBy('students.created_at', 'desc');

  res.json({
    success: true,
    students
  });
});

// Get student profile (for current student)
const getStudentProfile = asyncHandler(async (req, res) => {
  const student = await db('students')
    .join('users', 'students.user_id', 'users.id')
    .leftJoin('users as supervisors', 'students.uni_supervisor_id', 'supervisors.id')
    .leftJoin('attachments', 'students.id', 'attachments.student_id')
    .select(
      'students.id',
      'students.reg_number',
      'students.program',
      'students.year_of_study',
      'users.name as student_name',
      'users.email as student_email',
      'supervisors.name as supervisor_name',
      'supervisors.email as supervisor_email',
      db.raw('COUNT(attachments.id) as attachment_count')
    )
    .where('students.user_id', req.user.id)
    .groupBy('students.id', 'users.id', 'supervisors.id')
    .first();

  if (!student) {
    return res.status(404).json({
      success: false,
      message: 'Student profile not found'
    });
  }

  res.json({
    success: true,
    student
  });
});

module.exports = {
  getAllStudents,
  getStudentById,
  createStudent,
  updateStudent,
  assignSupervisor,
  getSupervisorStudents,
  getStudentProfile
};
