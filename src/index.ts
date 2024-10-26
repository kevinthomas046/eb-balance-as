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

/**
 * Special function that handles HTTP GET requests to the published web app.
 * @return {GoogleAppsScript.HTML.HtmlOutput} The HTML page to be served.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
function doGet() {
    Logger.log('Loading page');
    return HtmlService.createTemplateFromFile('page')
      .evaluate()
      .setTitle('Balance | Elevation Beats Inc');
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