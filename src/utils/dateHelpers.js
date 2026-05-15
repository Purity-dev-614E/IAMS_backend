/**
 * Helper function to get week number from a date
 */
function getWeekNumber(date) {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const daysDiff = Math.floor((date - firstDay) / (24 * 60 * 60 * 1000));
  return Math.ceil(daysDiff / 7);
}

/**
 * Helper function to get week start date (Monday)
 */
function getWeekStartDate(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/**
 * Helper function to get week end date (Sunday)
 */
function getWeekEndDate(date) {
  const startDate = getWeekStartDate(date);
  return new Date(startDate.setDate(startDate.getDate() + 4)); // Friday
}

/**
 * Helper function to get week number relative to attachment start date
 */
function getAttachmentWeekNumber(logDate, attachmentStartDate) {
  const logD = new Date(logDate);
  const startD = new Date(attachmentStartDate);
  
  // Normalize both to midnight UTC for accurate day difference
  const logT = new Date(logD.getFullYear(), logD.getMonth(), logD.getDate()).getTime();
  const startT = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate()).getTime();
  
  // Calculate difference in days
  const diffInMs = logT - startT;
  const diffInDays = Math.floor(diffInMs / (24 * 60 * 60 * 1000));
  
  // If log is before start date, it's still Week 1 (or handle as negative, but Week 1 is safer for display)
  if (diffInDays < 0) return 1;
  
  return Math.floor(diffInDays / 7) + 1; // 0-6 days = Week 1, 7-13 days = Week 2, etc.
}

/**
 * Helper function to group logs by week relative to attachment start
 */
function groupLogsByWeek(dailyLogs, attachmentStartDate) {
  const weeklyGroups = {};
  
  for (const log of dailyLogs) {
    const logDate = new Date(log.log_date);
    const weekNumber = attachmentStartDate 
      ? getAttachmentWeekNumber(logDate, attachmentStartDate)
      : getWeekNumber(logDate);
    
    if (!weeklyGroups[weekNumber]) {
      let startDate, endDate;
      
      if (attachmentStartDate) {
        // Calculate relative week boundaries
        const start = new Date(attachmentStartDate);
        start.setHours(0, 0, 0, 0);
        const weekStart = new Date(start.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(weekStart.getTime() + 4 * 24 * 60 * 60 * 1000); // Friday
        startDate = weekStart;
        endDate = weekEnd;
      } else {
        startDate = getWeekStartDate(logDate);
        endDate = getWeekEndDate(logDate);
      }
      
      weeklyGroups[weekNumber] = {
        startDate,
        endDate,
        logs: []
      };
    }
    
    weeklyGroups[weekNumber].logs.push(log);
  }
  
  return weeklyGroups;
}

module.exports = {
  getWeekNumber,
  getAttachmentWeekNumber,
  getWeekStartDate,
  getWeekEndDate,
  groupLogsByWeek
};
