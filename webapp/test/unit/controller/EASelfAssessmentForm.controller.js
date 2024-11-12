/*global QUnit*/

sap.ui.define([
	"easelfassessment/controller/EASelfAssessmentForm.controller"
], function (Controller) {
	"use strict";

	QUnit.module("EASelfAssessmentForm Controller");

	QUnit.test("I should test the EASelfAssessmentForm controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
