const DEFAULT_COLLEGES = {
  COETEC: {
    code: 'COETEC',
    name: 'College of Engineering and Technology',
    aliases: ['COETEC', 'ENGINEERING', 'TECHNOLOGY', 'CIVIL', 'MECHANICAL', 'MECHATRONIC', 'ELECTRICAL'],
    focusAreas: ['Civil Engineering', 'Mechanical Engineering', 'Mechatronic Engineering', 'Electrical Engineering'],
    curriculumYears: 5,
    eligibleFromYear: 3,
    maxEligibleYear: 5,
    maxAttachments: 3
  },
  COANR: {
    code: 'COANR',
    name: 'College of Agriculture and Natural Resources',
    aliases: ['COANR', 'AGRICULTURE', 'NATURAL RESOURCES', 'HORTICULTURE', 'FOOD TECHNOLOGY'],
    focusAreas: ['Horticulture', 'Food Technology', 'Agriculture'],
    curriculumYears: 4,
    eligibleFromYear: 3,
    maxEligibleYear: 4,
    maxAttachments: 3
  },
  COPAS: {
    code: 'COPAS',
    name: 'College of Pure and Applied Sciences',
    aliases: ['COPAS', 'PURE AND APPLIED SCIENCES', 'MATHEMATICS', 'PHYSICS', 'BIOLOGICAL SCIENCES'],
    focusAreas: ['Mathematics', 'Physics', 'Biological Sciences'],
    curriculumYears: 4,
    eligibleFromYear: 3,
    maxEligibleYear: 4,
    maxAttachments: 2
  },
  COHES: {
    code: 'COHES',
    name: 'College of Health Sciences',
    aliases: ['COHES', 'HEALTH SCIENCES', 'MEDICINE', 'BIOMEDICAL SCIENCES', 'NURSING'],
    focusAreas: ['Medicine', 'Biomedical Sciences', 'Nursing'],
    curriculumYears: 5,
    eligibleFromYear: 3,
    maxEligibleYear: 5,
    maxAttachments: 3
  },
  CHRD: {
    code: 'CHRD',
    name: 'College of Human Resource and Development',
    aliases: ['CHRD', 'COHRED', 'HUMAN RESOURCE', 'DEVELOPMENT', 'BUSINESS', 'COMMERCE'],
    focusAreas: ['Business', 'Commerce', 'Human Resource Management'],
    curriculumYears: 4,
    eligibleFromYear: 3,
    maxEligibleYear: 4,
    maxAttachments: 1
  }
};

const DEFAULT_COLLEGE_RULE = {
  code: 'DEFAULT',
  name: 'Default College Rule',
  aliases: [],
  focusAreas: [],
  curriculumYears: 4,
  eligibleFromYear: 3,
  maxEligibleYear: 4,
  maxAttachments: 1
};

const parseCollegeRules = () => {
  const rawRules = process.env.ATTACHMENT_COLLEGE_RULES_JSON || process.env.ATTACHMENT_SCHOOL_RULES_JSON;

  if (!rawRules) {
    return DEFAULT_COLLEGES;
  }

  try {
    const configuredRules = JSON.parse(rawRules);
    const mergedRules = { ...DEFAULT_COLLEGES };

    for (const [code, rule] of Object.entries(configuredRules)) {
      const normalizedCode = normalizeCollegeCode(code);
      mergedRules[normalizedCode] = {
        ...(mergedRules[normalizedCode] || DEFAULT_COLLEGE_RULE),
        ...rule,
        code: rule.code || normalizedCode
      };
    }

    return mergedRules;
  } catch (error) {
    console.warn('Invalid attachment college rules JSON. Falling back to default college rules.');
    return DEFAULT_COLLEGES;
  }
};

const normalizeCollegeCode = (value) => {
  if (!value) return null;
  return String(value).trim().toUpperCase();
};

const getColleges = () => {
  return Object.values(parseCollegeRules()).map((college) => ({
    code: college.code,
    name: college.name,
    focusAreas: college.focusAreas || [],
    curriculumYears: college.curriculumYears,
    eligibleFromYear: college.eligibleFromYear,
    maxEligibleYear: college.maxEligibleYear,
    maxAttachments: college.maxAttachments
  }));
};

const inferCollegeFromProgram = (program) => {
  const normalizedProgram = normalizeCollegeCode(program);
  if (!normalizedProgram) return null;

  for (const college of Object.values(parseCollegeRules())) {
    const aliases = [college.code, college.name, ...(college.aliases || []), ...(college.focusAreas || [])];
    if (aliases.some((alias) => normalizedProgram.includes(normalizeCollegeCode(alias)))) {
      return college.code;
    }
  }

  return null;
};

const getRuleForStudent = (student) => {
  const collegeCode = normalizeCollegeCode(student.school) || inferCollegeFromProgram(student.program);
  const rules = parseCollegeRules();

  return {
    collegeCode: collegeCode || 'DEFAULT',
    rule: rules[collegeCode] || DEFAULT_COLLEGE_RULE
  };
};

const getCurrentAcademicYear = () => {
  const configuredYear = parseInt(process.env.CURRENT_ACADEMIC_YEAR, 10);
  if (Number.isInteger(configuredYear)) return configuredYear;

  return new Date().getFullYear();
};

const getIntakeYear = (registrationNumber) => {
  const match = String(registrationNumber || '').match(/\/(\d{4})$/);
  if (!match) {
    throw new Error('Invalid registration number format');
  }

  return Number(match[1]);
};

const getEffectiveYearOfStudy = (student) => {
  if (student.year_of_study) {
    return Number(student.year_of_study);
  }

  if (student.admission_year) {
    return getCurrentAcademicYear() - Number(student.admission_year) + 1;
  }

  return null;
};

const getActiveApprovedOverride = async (db, studentId) => {
  const today = new Date().toISOString().slice(0, 10);

  return db('attachment_eligibility_reviews')
    .where({
      student_id: studentId,
      status: 'approved'
    })
    .andWhere(function() {
      this.whereNull('expires_at').orWhere('expires_at', '>=', today);
    })
    .orderBy('reviewed_at', 'desc')
    .first();
};

const getPendingReview = async (db, studentId) => {
  return db('attachment_eligibility_reviews')
    .where({
      student_id: studentId,
      status: 'pending'
    })
    .orderBy('created_at', 'desc')
    .first();
};

const getAttachmentUsage = async (db, studentId) => {
  const [{ count }] = await db('attachments')
    .where('student_id', studentId)
    .whereNot('status', 'inactive')
    .count('* as count');

  return Number(count);
};

const evaluateAttachmentEligibility = async (db, student) => {
  const approvedOverride = await getActiveApprovedOverride(db, student.id);
  const pendingReview = await getPendingReview(db, student.id);
  const { collegeCode, rule } = getRuleForStudent(student);
  const attachmentCount = await getAttachmentUsage(db, student.id);
  const maxAttachments = Number(rule.maxAttachments || DEFAULT_COLLEGE_RULE.maxAttachments);

  if (approvedOverride) {
    return {
      eligible: true,
      source: 'admin_override',
      message: 'Eligible through approved eligibility review',
      review: approvedOverride,
      canRequestReview: false,
      attachmentCount,
      remainingAttachments: Math.max(maxAttachments - attachmentCount, 0),
      rule: {
        college: collegeCode,
        collegeName: rule.name,
        curriculumYears: rule.curriculumYears,
        eligibleFromYear: rule.eligibleFromYear,
        maxEligibleYear: rule.maxEligibleYear,
        maxAttachments
      }
    };
  }

  if (attachmentCount >= maxAttachments) {
    return {
      eligible: false,
      source: 'attachment_limit',
      message: `${rule.name} allows up to ${maxAttachments} attachment registration${maxAttachments === 1 ? '' : 's'}.`,
      canRequestReview: !pendingReview,
      pendingReview,
      attachmentCount,
      remainingAttachments: 0,
      rule: {
        college: collegeCode,
        collegeName: rule.name,
        curriculumYears: rule.curriculumYears,
        eligibleFromYear: rule.eligibleFromYear,
        maxEligibleYear: rule.maxEligibleYear,
        maxAttachments
      }
    };
  }

  const academicStatus = student.academic_status || 'active';
  if (academicStatus !== 'active') {
    return {
      eligible: false,
      source: 'academic_status',
      message: `Students with ${academicStatus} academic status cannot register for attachment automatically.`,
      canRequestReview: !pendingReview,
      pendingReview,
      attachmentCount,
      remainingAttachments: Math.max(maxAttachments - attachmentCount, 0)
    };
  }

  const yearOfStudy = getEffectiveYearOfStudy(student);
  if (!yearOfStudy) {
    return {
      eligible: false,
      source: 'missing_academic_data',
      message: 'Your academic year could not be determined. Please request eligibility review.',
      canRequestReview: !pendingReview,
      pendingReview,
      attachmentCount,
      remainingAttachments: Math.max(maxAttachments - attachmentCount, 0)
    };
  }

  const eligible = yearOfStudy >= rule.eligibleFromYear && yearOfStudy <= rule.maxEligibleYear;

  return {
    eligible,
    source: 'school_rule',
    message: eligible
      ? 'Eligible for attachment registration'
      : `Students in ${rule.name} are eligible from year ${rule.eligibleFromYear} to year ${rule.maxEligibleYear}.`,
    canRequestReview: !eligible && !pendingReview,
    pendingReview,
    attachmentCount,
    remainingAttachments: Math.max(maxAttachments - attachmentCount, 0),
    rule: {
      college: collegeCode,
      collegeName: rule.name,
      curriculumYears: rule.curriculumYears,
      eligibleFromYear: rule.eligibleFromYear,
      maxEligibleYear: rule.maxEligibleYear,
      maxAttachments
    },
    yearOfStudy
  };
};

module.exports = {
  evaluateAttachmentEligibility,
  getIntakeYear,
  getEffectiveYearOfStudy,
  getRuleForStudent,
  getColleges
};
