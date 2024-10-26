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

function getBalancesByDate(filterDate: string) {
  const parsedFilterDate = Date.parse(filterDate);

  const familyData = getSheetByName(SHEETS.FAMILIES);
  const attendanceData = getSheetByName(SHEETS.ATTENDANCE);
  const studentsData = getSheetByName(SHEETS.STUDENTS);
  const classData = getSheetByName(SHEETS.CLASSES);
  const classGroupData = getSheetByName(SHEETS.CLASS_GROUPS);
  const additionalFeesData = getSheetByName(SHEETS.ADDITIONAL_FEES);
  const paymentData = getSheetByName(SHEETS.PAYMENTS);

  const groupedStudents = studentsData.reduce(
    (groupedStudents, [id, , familyId]) => {
      groupedStudents[familyId] ??= [];
      groupedStudents[familyId].push(id);
      return groupedStudents;
    },
    {} as Record<string, string[]>
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

  return familyData.reduce(
    (familyBalance, [familyId, familyName]) => {
      if (familyName === '') return familyBalance;

      const studentsInFamily = groupedStudents[familyId];
      const classBalance = Object.values(expandedAttendanceData).reduce(
        (classBalance, { studentId, date, price }) => {
          if (
            studentsInFamily.includes(studentId as string) &&
            parsedFilterDate >= Date.parse(date as string)
          ) {
            classBalance += Number(price);
          }
          return classBalance;
        },
        0
      );
      const additionalFees = additionalFeesData.reduce(
        (additionalFees, [, studentId, feeDate, , price]) => {
          if (
            studentsInFamily.includes(studentId) &&
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
      const balance = classBalance + additionalFees - paymentTotal;

      familyBalance.push({
        name: familyName,
        classBalance,
        additionalFees,
        paymentTotal,
        balance,
      });
      return familyBalance;
    },
    [] as Record<
      'name' | 'classBalance' | 'additionalFees' | 'paymentTotal' | 'balance',
      number
    >[]
  );
}
