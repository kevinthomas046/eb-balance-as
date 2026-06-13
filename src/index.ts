/**
 * Copyright 2024 Elevation Beats Inc
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

const SPREADSHEET_ID: string =
  PropertiesService.getScriptProperties().getProperty('SHEET_ID') || '';

const SHEETS = {
  FAMILIES: 'Families',
  STUDENTS: 'Students',
  ATTENDANCE: 'Attendance',
  PAYMENTS: 'Payments',
  CLASSES: 'Classes',
  CLASS_GROUPS: 'ClassGroups',
  ADDITIONAL_FEES: 'AdditionalFees',
  ABSENCE: 'Absence',
};

/**
 * Special function that handles HTTP GET requests to the published web app.
 * @return {GoogleAppsScript.HTML.HtmlOutput} The HTML page to be served.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
function doGet() {
  Logger.log('Loading page');
  console.log(SpreadsheetApp.getActiveSpreadsheet().getName());
  return HtmlService.createTemplateFromFile('page')
    .evaluate()
    .setTitle('Balance Admin | Elevation Beats Inc');
}

/**
 * Includes template based on filename that has a nested include
 * @param filename file name to be included
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
function includeTemplate(filename: string) {
  return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
}

/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Includes template based on filename
 * @param filename file name to be included
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function include(filename: string) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Retrieves a reference to a Google sheet by name.
 * @param {string} sheetName Name of the sheet to retrieve
 */
function getSheetByName(
  sheetName: string
): ReturnType<GoogleAppsScript.Spreadsheet.Range['getValues']> {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet with name ${sheetName} not found.`);
  }
  return sheet.getDataRange().getValues().slice(1);
}

function getFeesMapByMonth(familyId: number) {
  // Get a list of students where familyID = input.familyID AND active = true
  const studentsData = getSheetByName('Students');
  const uniqueClassGroupIds: number[] = Array.from(
    new Set(
      studentsData
        .slice(1)
        .filter(row => row[2] === familyId && row[4] === true)
        .map(row => row[3])
    )
  );

  console.log('Class groups for family ', familyId, 'are', uniqueClassGroupIds);

  const classesData = getSheetByName('Classes');
  const classGroupsData = getSheetByName('ClassGroups')
    .filter(row => row[0] && row[1])
    .reduce(
      (acc, [groupId, groupName, classPrice]) => {
        acc[groupId] = classPrice;
        return acc;
      },
      {} as Record<number, number>
    );

  const feesByMonthMap = classesData.slice(1).reduce(
    (acc, [classId, classGroupId, classDate, classPrice]) => {
      if (classId) {
        const classDateObj = new Date(classDate);
        const classMonth = classDateObj.getMonth();
        const classMonthLong = new Intl.DateTimeFormat('en-US', {
          month: 'long',
        }).format(classDateObj);
        const price = classPrice || classGroupsData[classGroupId];

        if (uniqueClassGroupIds.includes(classGroupId)) {
          if (acc[classMonth]) {
            acc[classMonth].price += price;
          } else {
            acc[classMonth] = {
              month: classMonthLong,
              price,
            };
          }
        }
      }
      return acc;
    },
    {} as Record<number, { price: number; month: string }>
  );

  return feesByMonthMap;
}

function getBalancesByDate(filterDate: string) {
  const parsedFilterDate = Date.parse(filterDate);
  const currentMonth = new Date().getMonth();

  const familyData = getSheetByName(SHEETS.FAMILIES);
  const attendanceData = getSheetByName(SHEETS.ATTENDANCE);
  const studentsData = getSheetByName(SHEETS.STUDENTS);
  const classData = getSheetByName(SHEETS.CLASSES);
  const classGroupData = getSheetByName(SHEETS.CLASS_GROUPS);
  const additionalFeesData = getSheetByName(SHEETS.ADDITIONAL_FEES);
  const paymentData = getSheetByName(SHEETS.PAYMENTS);

  const groupedStudents = studentsData.reduce(
    (groupedStudents, [id, , familyId, classGroupId, isActive]) => {
      groupedStudents[familyId] ??= [];
      groupedStudents[familyId].push({
        id,
        classGroupId,
        isActive,
      });
      return groupedStudents;
    },
    {} as Record<
      string,
      Record<'id' | 'classGroupId' | 'isActive', string | number | boolean>[]
    >
  );

  const groupedClassGroups = classGroupData.reduce(
    (groupedClassGroups, [id, name, price]) => {
      groupedClassGroups[id] = {
        id,
        name,
        price,
      };
      return groupedClassGroups;
    },
    {} as Record<string, Record<'id' | 'name' | 'price', string | number>>
  );

  const expandedAttendanceData = attendanceData.reduce(
    (expandedAttendanceData, [id, studentId, classId, , price]) => {
      const [, classGroupId, classDate, classPrice] =
        classData.find(([id]) => id === classId) ?? [];
      const calculatedPrice =
        price !== ''
          ? price
          : classPrice || groupedClassGroups[classGroupId].price;
      expandedAttendanceData[id] = {
        studentId,
        date: classDate,
        price: calculatedPrice,
      };
      return expandedAttendanceData;
    },
    {} as Record<
      string,
      Record<'studentId' | 'date' | 'price', string | number>
    >
  );

  // Name
  // Class Group
  // Class Total
  // Additional Fees
  // Paid Total
  // Paid Full Balance ✅ / ❌
  // Credits

  return familyData.reduce((familyBalance, [familyId, familyName]) => {
    if (familyName === '') return familyBalance;

    const studentsInFamily = groupedStudents[familyId];
    const hasActiveStudents = studentsInFamily.some(
      student => student.isActive
    );

    if (!hasActiveStudents) return familyBalance;

    const studentIdsInFamily = studentsInFamily.map(({ id }) => id);
    const studentClassGroups = studentsInFamily.map(
      ({ classGroupId }) => classGroupId
    );

    const feesByMonthMap = getFeesMapByMonth(familyId);

    // Add up all the monthly fees up to current month
    const classFees = Object.entries(feesByMonthMap).reduce(
      (acc, [month, fee]) => {
        if (currentMonth >= Number(month)) {
          acc += fee.price;
        }

        return acc;
      },
      0
    );

    const additionalFees = additionalFeesData.reduce(
      (additionalFees, [, studentId, feeDate, , price]) => {
        if (
          studentIdsInFamily.includes(studentId) &&
          parsedFilterDate >= Date.parse(feeDate)
        ) {
          additionalFees += Number(price);
        }
        return additionalFees;
      },
      0
    );

    const paymentTotal = paymentData.reduce(
      (paymentTotal, [, attendanceFamilyId, paymentDate, amountPaid]) => {
        if (
          attendanceFamilyId === familyId &&
          parsedFilterDate >= Date.parse(paymentDate)
        ) {
          paymentTotal += Number(amountPaid);
        }
        return paymentTotal;
      },
      0
    );

    const balance = classFees + additionalFees - paymentTotal;

    familyBalance.push({
      name: familyName,
      classFees,
      additionalFees,
      paymentTotal,
      balance,
      isPaidInFull: balance * -1 >= 0,
      credits: 0,
    });
    return familyBalance;
  }, []);
}

interface FamilySummary {
  familyId: number;
  familyName: string;
  balance: number;
  credit: number;
  refunds: number;
  paymentDates: Date[];
  classFees: number;
  additionalCharges: number;
  additionalCredits: number;
  cancelledCredits: number;
  paymentTotal: number;
}

interface StudentRecord {
  studentId: number;
  familyId: number;
  classGroupId: number;
  active: boolean;
  startDate: number | null;
  endDate: number | null;
}

interface ClassRecord {
  date: number;
  price: number;
  cancelled: boolean;
}

interface AbsenceRecord {
  start: number | null;
  end: number | null;
}

interface FinancialSummaryMap {
  [familyId: number]: FamilySummary;
}

function buildFinancialSummary(): FinancialSummaryMap {
  const students = getSheetByName(SHEETS.STUDENTS);
  const classes = getSheetByName(SHEETS.CLASSES);
  const classGroups = getSheetByName(SHEETS.CLASS_GROUPS);
  const payments = getSheetByName(SHEETS.PAYMENTS);
  const additionalFees = getSheetByName(SHEETS.ADDITIONAL_FEES);
  const absences = getSheetByName(SHEETS.ABSENCE);
  const families = getSheetByName(SHEETS.FAMILIES);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayMs = today.getTime();

  const familyMap: FinancialSummaryMap = {};

  // Families
  families.forEach(([familyId, familyName]) => {
    familyMap[familyId as number] = {
      familyId: familyId as number,
      familyName: String(familyName),
      balance: 0,
      credit: 0,
      refunds: 0,
      paymentDates: [],
      classFees: 0,
      additionalCharges: 0,
      additionalCredits: 0,
      cancelledCredits: 0,
      paymentTotal: 0,
    };
  });

  // Class Group Prices
  const classGroupPriceMap = new Map<number, number>();

  classGroups.forEach(([groupId, , price]) => {
    classGroupPriceMap.set(groupId as number, Number(price) || 0);
  });

  // Absences
  const absenceMap = new Map<number, AbsenceRecord[]>();

  absences.forEach(([studentId, startDate, endDate]) => {
    const record: AbsenceRecord = {
      start: startDate ? new Date(startDate as Date).getTime() : null,
      end: endDate ? new Date(endDate as Date).getTime() : null,
    };

    const existing = absenceMap.get(studentId as number) ?? [];

    existing.push(record);

    absenceMap.set(studentId as number, existing);
  });

  // Classes By Group
  const classesByGroup = new Map<number, ClassRecord[]>();

  classes.forEach(([, classGroupId, classDate, classPrice, cancelled]) => {
    const groupId = classGroupId as number;

    const classRecord: ClassRecord = {
      date: new Date(classDate as Date).getTime(),
      price: Number(classPrice) || classGroupPriceMap.get(groupId) || 0,
      cancelled: Boolean(cancelled),
    };

    const existing = classesByGroup.get(groupId) ?? [];

    existing.push(classRecord);

    classesByGroup.set(groupId, existing);
  });

  // Student → Family Map
  const studentFamilyMap = new Map<number, number>();

  students.forEach(([studentId, , familyId]) => {
    studentFamilyMap.set(studentId as number, familyId as number);
  });

  // Student Processing
  students.forEach(student => {
    const [studentId, , familyId, classGroupId, active, startDate, endDate] =
      student;

    if (!active) {
      return;
    }

    const family = familyMap[familyId as number];

    if (!family) {
      return;
    }

    const startMs = startDate ? new Date(startDate as Date).getTime() : null;

    const endMs = endDate ? new Date(endDate as Date).getTime() : null;

    const studentAbsences = absenceMap.get(studentId as number) ?? [];

    const groupClasses = classesByGroup.get(classGroupId as number) ?? [];

    for (const cls of groupClasses) {
      if (startMs && cls.date < startMs) continue;
      if (endMs && cls.date > endMs) continue;

      const absent = studentAbsences.some(
        absence =>
          (!absence.start || cls.date >= absence.start) &&
          (!absence.end || cls.date <= absence.end)
      );

      if (absent) continue;

      if (cls.date < todayMs) {
        family.classFees += cls.price;
      }

      if (cls.cancelled && cls.date < todayMs) {
        family.cancelledCredits += cls.price;
      }
    }
  });

  // Additional Fees
  additionalFees.forEach(([, studentId, , , price]) => {
    const familyId = studentFamilyMap.get(studentId as number);

    if (!familyId) {
      return;
    }

    const family = familyMap[familyId];

    const amount = Number(price) || 0;

    if (amount > 0) {
      family.additionalCharges += amount;
    } else {
      family.additionalCredits += amount;
    }
  });

  // Payments
  payments.forEach(([, familyId, paymentDate, amountPaid]) => {
    const family = familyMap[familyId as number];

    if (!family) {
      return;
    }

    const amount = Number(amountPaid) || 0;

    family.paymentDates.push(new Date(paymentDate as Date));

    family.paymentTotal += Math.abs(amount);

    if (amount < 0) {
      family.refunds += Math.abs(amount);
    }
  });

  // Final Calculations
  Object.values(familyMap).forEach(family => {
    const balance =
      family.classFees + family.additionalCharges - family.paymentTotal;

    const overpaymentCredit = Math.abs(Math.min(balance, 0));

    family.balance = Math.max(balance, 0);

    family.credit =
      family.cancelledCredits +
      family.additionalCredits +
      overpaymentCredit -
      family.refunds;
  });

  return familyMap;
}

function getActiveFamilyFinancialReport(): (Omit<
  FamilySummary,
  'paymentDates'
> & { paymentDates: string[] })[] {
  const summaryMap = buildFinancialSummary();

  const students = getSheetByName(SHEETS.STUDENTS);

  const activeFamilyIds = [
    ...new Set(
      students.filter(row => row[4] === true).map(row => row[2] as number)
    ),
  ];

  const activeFamilyData = activeFamilyIds.map(familyId => {
    const familySummary = summaryMap[familyId];

    return {
      familyId: familySummary.familyId,
      familyName: familySummary.familyName,
      balance: familySummary.balance,
      credit: familySummary.credit,
      refunds: familySummary.refunds,
      paymentDates: familySummary.paymentDates.map(d => d.toLocaleDateString()),
      classFees: familySummary.classFees,
      additionalCharges: familySummary.additionalCharges,
      additionalCredits: familySummary.additionalCredits,
      cancelledCredits: familySummary.cancelledCredits,
      paymentTotal: familySummary.paymentTotal,
    };
  });

  console.log('Summary Data', activeFamilyData);

  return activeFamilyData;
}

function printData() {
  console.log(getActiveFamilyFinancialReport());
}
