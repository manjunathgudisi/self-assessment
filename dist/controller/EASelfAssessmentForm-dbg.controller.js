
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/IconTabFilter",
    "sap/m/Label",
    "sap/m/RadioButtonGroup",
    "sap/m/RadioButton",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/MultiComboBox",
    "sap/ui/core/Item",
    "sap/ui/model/json/JSONModel",
],
    function (Controller, IconTabFilter, Label, RadioButtonGroup, RadioButton, MessageBox, MessageToast, MultiComboBox, Item, JSONModel) {
        "use strict";

        return Controller.extend("easelfassessment.controller.EASelfAssessmentForm", {
            onInit: function () {
                this.selectedSkills = [];
                this._loadData();
            },

            _loadData: function () {
                const oModel = this.getOwnerComponent().getModel("datamodel");
                oModel.setSizeLimit(500);
                this.getView().setModel(oModel);

                oModel.bindList("/Skills").requestContexts().then((aContexts) => {
                    const oData = aContexts.map(oContext => oContext.getObject());
                    this._createIconTabBar(oData);
                }).catch((oError) => {
                    MessageBox.error("Failed to fetch data: " + oError.message);
                });
            },


            _createIconTabBar: function (skills) {
                const groupedSkills = this._groupBySkillType(skills);
                const oIconTabBar = this.byId("idIconTabBar");
                oIconTabBar.removeAllItems(); // Clear existing content

                oIconTabBar.addStyleClass("sapUiSmallMargin");

                for (let skillType in groupedSkills) {
                    const skillsForType = groupedSkills[skillType];

                    const oIconTabFilter = new IconTabFilter({
                        text: skillType,
                        key: skillType
                    });

                    skillsForType.forEach(skill => {
                        const oSkillLabel = new Label({ text: skill.skillDescription }).addStyleClass("sapUiSizeCompact");

                        const oRadioButtonGroup = new RadioButtonGroup({
                            columns: 5,
                            valueState: "Warning",
                            select: this._onRadioButtonSelect.bind(this, skill.skillDescription)
                        });

                        oRadioButtonGroup.addButton(new RadioButton({ text: "Beginner", customData: { key: "level", value: "1" } }));
                        oRadioButtonGroup.addButton(new RadioButton({ text: "Intermediate", customData: { key: "level", value: "2" } }));
                        oRadioButtonGroup.addButton(new RadioButton({ text: "Expert", customData: { key: "level", value: "3" } })).addStyleClass("sapUiSmallMargin");

                        oIconTabFilter.addContent(oSkillLabel);
                        oIconTabFilter.addContent(oRadioButtonGroup);
                    });

                    // Add MultiComboBox if skillType is Enterprise Architecture
                    if (skillType === "Enterprise Architecture") {
                        const oMultiComboBox = new MultiComboBox({
                            placeholder: "Select up to 3 skills",
                            maxWidth: "100%",
                            selectionChange: function (oEvent) {
                                const selectedItems = oEvent.getSource().getSelectedItems();
                                if (selectedItems.length > 3) {
                                    // If more than 3 items are selected, keep only the first 3
                                    const itemToRemove = oEvent.getParameter("changedItem");
                                    oEvent.getSource().setSelectedItems(selectedItems.filter(item => item !== itemToRemove));
                                    MessageToast.show("You can only select up to 3 skills");
                                }
                            },
                            items: skillsForType.map(skill =>
                                new Item({
                                    key: skill.ID,
                                    text: skill.skillDescription
                                })
                            )
                        });

                        const textLabel = new Label({ text: "Please choose top 3 Enterprise Architecture (EA) skills that you want to discuss with your manager for your career development." });
                        textLabel.addStyleClass("sapUiTinyMarginTop");
                        oIconTabFilter.addContent(textLabel);
                        oIconTabFilter.addContent(oMultiComboBox);
                    }

                    oIconTabBar.addItem(oIconTabFilter);
                }
            },


            _groupBySkillType: function (skills) {
                return skills.reduce((acc, skill) => {
                    (acc[skill.skillType] = acc[skill.skillType] || []).push(skill);
                    return acc;
                }, {});
            },

            _onRadioButtonSelect: function (skillDescription, oEvent) {
                const oRadioButtonGroup = oEvent.getSource();
                const selectedIndex = oRadioButtonGroup.getSelectedIndex();
                const level = selectedIndex + 1;

                // Store or update the selected skill
                const existingIndex = this.selectedSkills.findIndex(skill => skill.skills === skillDescription);
                if (existingIndex !== -1) {
                    this.selectedSkills[existingIndex].level = level;
                } else {
                    this.selectedSkills.push({
                        skills: skillDescription,
                        level: level
                    });
                }

                console.log("Current selections:", this.selectedSkills);
            },

            _getEaIdAndSubmitSkills: function (empId) {
                const oModel = this.getView().getModel("datamodel");

                // Create a binding for EAs filtered by empId
                const oBindList = oModel.bindList("/EAs", null, null, [
                    new sap.ui.model.Filter("empId", "EQ", empId)
                ]);

                return oBindList.requestContexts().then((aContexts) => {
                    if (aContexts.length === 0) {
                        throw new Error("No EA found with Employee ID: " + empId);
                    }
                    return aContexts[0].getObject().ID;
                });
            },


            onSubmit: function () {
                // Validate required fields
                const empId = this.getView().byId("employeeIDInput").getValue();
                const name = this.getView().byId("employeeSurname").getValue();
                const region = this.getView().byId("employeeRegion").getValue();
                const email = this.getView().byId("employeeEmailt").getValue();
                const country = this.getView().byId("employeeCountryt").getValue();

                if (!empId || !name || !region) {
                    MessageBox.error("Please fill in all required fields");
                    return;
                }

                if (this.selectedSkills.length === 0) {
                    MessageBox.error("Please select at least one skill level");
                    return;
                }

                MessageBox.confirm("Are you sure you want to submit the assessment?", {
                    onClose: (oAction) => {
                        if (oAction === MessageBox.Action.OK) {
                            //this._submitAssessment();
                            this._submitAssessmentWithDeepInsert();
                        }
                    }
                });
            },

            _submitAssessmentWithDeepInsert: async function () {
                try {
                    sap.ui.core.BusyIndicator.show(0);
                    const oModel = this.getView().getModel("datamodel");

                    //Assignments
                    const tableData = this._getTableData();
                    const assignments = [];
                    const assignmentPromises = tableData.map(assignment => {
                        const payload = {
                            CustomerName: assignment.customerName,
                            CRMId: assignment.cRMID,
                            isActive: assignment.isActiveEngagement,
                            isLead: assignment.requireShadowing,
                            leadEA: assignment.shadowEA,
                            comment: assignment.comment
                        };
                        assignments.push(payload);
                    });

                    //Top 3 skills
                    const oIconTabBar = this.byId("idIconTabBar");
                    const eaTabFilter = oIconTabBar.getItems().find(item => item.getText() === "Enterprise Architecture");
                    const top3Skills = [];
                    if (eaTabFilter) {
                        const oMultiComboBox = eaTabFilter.getContent().find(control => control instanceof MultiComboBox);
                        if (oMultiComboBox) {
                            const top3items = oMultiComboBox.getSelectedItems();
                            const top3Promises = top3items.map(item => {
                                const payload = {
                                    skills: item.getText()
                                }
                                top3Skills.push(payload);
                            });
                        }
                    }

                    //Skills
                    const skillsToSubmit = [];
                    const topSkillsPromises = this.selectedSkills.map(skill => {
                        const payload = {
                            level: skill.level,
                            skills: skill.skills
                        };
                        skillsToSubmit.push(payload);
                    });

                    // prepare EA data with deep insert
                    const eaData = {
                        empId: this.getView().byId("employeeIDInput").getValue(),
                        name: this.getView().byId("employeeSurname").getValue(),
                        region: this.getView().byId("employeeRegion").getValue(),
                        email: this.getView().byId("employeeEmailt").getValue(),
                        country: this.getView().byId("employeeCountryt").getValue(),
                        assignments: assignments,
                        development: top3Skills,
                        experience: skillsToSubmit
                    };

                    // Create the EA
                    await this._createEA(oModel, eaData);

                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.success("Assessment submitted successfully!", {
                        onClose: () => {
                            this._resetForm();
                        }
                    });

                } catch (error) {
                    sap.ui.core.BusyIndicator.hide();
                    console.error("Submission error:", error);
                    MessageBox.error("Error submitting assessment: " + (error.message || "Unknown error occurred"));
                }
            },

            _submitAssessment: async function () {
                try {
                    sap.ui.core.BusyIndicator.show(0);
                    const oModel = this.getView().getModel("datamodel");

                    // 1. First API Call - Create EA
                    const eaData = {
                        empId: this.getView().byId("employeeIDInput").getValue(),
                        name: this.getView().byId("employeeSurname").getValue(),
                        region: this.getView().byId("employeeRegion").getValue(),
                        email: this.getView().byId("employeeEmailt").getValue(),
                        country: this.getView().byId("employeeCountryt").getValue()
                    };

                    // Create the EA
                    await this._createEA(oModel, eaData);

                    // 2. Get the EA ID using the employee details
                    const eaId = await this._getEAIdByEmployeeDetails(oModel, eaData);
                    console.log("EA ID obtained:", eaId);

                    // 3. Second API Call - Create Assignments
                    const assignments = this._getTableData();
                    if (assignments.length > 0) {
                        await this._createAssignments(oModel, eaId, assignments);
                        console.log("Assignments created successfully");
                    }

                    // 4. Third API Call - Create Skills
                    if (this.selectedSkills.length > 0) {
                        await this._createSkills(oModel, eaId);
                        console.log("Skills created successfully");
                    }

                    // 5. Fourth API Call - Create Skill Development entries
                    const oIconTabBar = this.byId("idIconTabBar");
                    const eaTabFilter = oIconTabBar.getItems().find(item => item.getText() === "Enterprise Architecture");
                    if (eaTabFilter) {
                        const oMultiComboBox = eaTabFilter.getContent().find(control => control instanceof MultiComboBox);
                        if (oMultiComboBox) {
                            await this._createSkillDevelopment(oModel, eaId, oMultiComboBox.getSelectedItems());
                            console.log("Skill Development entries created successfully");
                        }
                    }

                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.success("Assessment submitted successfully!", {
                        onClose: () => {
                            this._resetForm();
                        }
                    });

                } catch (error) {
                    sap.ui.core.BusyIndicator.hide();
                    console.error("Submission error:", error);
                    MessageBox.error("Error submitting assessment: " + (error.message || "Unknown error occurred"));
                }
            },

            // New method to handle Skill Development API calls
            _createSkillDevelopment: function (oModel, eaId, selectedItems) {
                return new Promise((resolve, reject) => {
                    try {
                        const createPromises = selectedItems.map(item => {
                            const payload = {
                                ea_ID: eaId,
                                skills: item.getText()
                            };

                            const sPath = "/SkillDevelopment";
                            const oSkillDevBinding = oModel.bindList(sPath);
                            const oSkillDevContext = oSkillDevBinding.create(payload);

                            return oSkillDevContext.created();
                        });

                        Promise.all(createPromises)
                            .then(() => resolve())
                            .catch(error => reject(new Error("Failed to create skill development entries: " + error.message)));
                    } catch (error) {
                        reject(new Error("Error in skill development creation: " + error.message));
                    }
                });
            },



            _createEA: function (oModel, eaData) {
                return new Promise((resolve) => {
                    const oListBinding = oModel.bindList("/EAs");
                    oListBinding.create(eaData);
                    resolve(); // Immediately resolve without waiting for created()
                });
            },


            _getEAIdByEmployeeDetails: function (oModel, eaData) {
                return new Promise((resolve, reject) => {
                    // Create a list binding for EAs filtered by empId
                    const oListBinding = oModel.bindList("/EAs", null, null, [
                        new sap.ui.model.Filter("empId", "EQ", eaData.empId)
                    ]);

                    // Request the context
                    oListBinding.requestContexts().then((aContexts) => {
                        if (aContexts.length > 0) {
                            const eaId = aContexts[0].getObject().ID;
                            resolve(eaId);
                        } else {
                            reject(new Error(`No EA found for Employee ID: ${eaData.empId}`));
                        }
                    }).catch((error) => {
                        reject(new Error("Failed to get EA ID: " + error.message));
                    });
                });
            },

            _createAssignments: function (oModel, eaId, assignments) {
                return new Promise((resolve, reject) => {
                    try {
                        const createPromises = assignments.map(assignment => {
                            const payload = {
                                CustomerName: assignment.customerName,
                                CRMId: assignment.cRMID,
                                isActive: assignment.isActiveEngagement,
                                isLead: assignment.requireShadowing,
                                leadEA: assignment.shadowEA,
                                comment: assignment.comment,
                                ea_ID: eaId
                            };

                            const sPath = `/EAs(${eaId})/assignments`;
                            const oAssignmentBinding = oModel.bindList(sPath);
                            const oAssignmentContext = oAssignmentBinding.create(payload);

                            return oAssignmentContext.created();
                        });

                        Promise.all(createPromises)
                            .then(() => resolve())
                            .catch(error => reject(new Error("Failed to create assignments: " + error.message)));
                    } catch (error) {
                        reject(new Error("Error in assignment creation: " + error.message));
                    }
                });
            },

            _createSkills: function (oModel, eaId) {
                return new Promise((resolve, reject) => {
                    try {
                        const createPromises = this.selectedSkills.map(skill => {
                            const payload = {
                                ea_ID: eaId,
                                level: skill.level,
                                skills: skill.skills
                            };

                            const sPath = `/EAs(${eaId})/experience`;
                            const oSkillBinding = oModel.bindList(sPath);
                            const oSkillContext = oSkillBinding.create(payload);

                            return oSkillContext.created();
                        });

                        Promise.all(createPromises)
                            .then(() => resolve())
                            .catch(error => reject(new Error("Failed to create skills: " + error.message)));
                    } catch (error) {
                        reject(new Error("Error in skill creation: " + error.message));
                    }
                });
            },

            _getTableData: function () {
                try {
                    const oTable = this.getView().byId("tableId1");
                    const aItems = oTable.getItems();

                    return aItems.map(item => {
                        const aCells = item.getCells();
                        return {
                            customerName: aCells[0].getValue(),
                            cRMID: aCells[1].getValue(),
                            isActiveEngagement: aCells[2].getSelected(),
                            requireShadowing: aCells[3].getSelected(),
                            shadowEA: aCells[4].getValue(),
                            comment: aCells[5].getValue()
                        };
                    }).filter(item => item.customerName || item.cRMID);
                } catch (error) {
                    console.error("Error in _getTableData:", error);
                    return [];
                }
            },

            _resetForm: function () {
                try {
                    // Reset input fields
                    ["employeeIDInput", "employeeSurname", "employeeRegion",
                        "employeeEmailt", "employeeCountryt"].forEach(fieldId => {
                            const field = this.getView().byId(fieldId);
                            if (field) {
                                field.setValue("");
                            }
                        });

                    // Clear table
                    const oTable = this.getView().byId("tableId1");
                    if (oTable) {
                        oTable.removeAllItems();
                    }

                    // Reset skills
                    this.selectedSkills = [];
                    const oIconTabBar = this.byId("idIconTabBar");
                    if (oIconTabBar) {
                        oIconTabBar.getItems().forEach(item => {
                            item.getContent().forEach(content => {
                                if (content instanceof RadioButtonGroup) {
                                    content.setSelectedIndex(-1);
                                }
                            });
                        });
                    }
                } catch (error) {
                    console.error("Error in _resetForm:", error);
                    MessageBox.error("Error resetting form: " + error.message);
                }
            },

            // Rest of the methods remain the same...
            onAdd: function (oEvent) {
                try {
                    var oItem = new sap.m.ColumnListItem({
                        cells: [
                            new sap.m.Input(),
                            new sap.m.Input(),
                            new sap.m.CheckBox(),
                            new sap.m.CheckBox(),
                            new sap.m.Input(),
                            new sap.m.Input()
                        ]
                    });
                    var oTable = this.getView().byId("tableId1");
                    oTable.addItem(oItem);
                } catch (error) {
                    console.error("Error in onAdd:", error);
                    MessageBox.error("Error adding row: " + error.message);
                }
            },

            deleteRow: function (oEvent) {
                try {
                    var oTable = this.getView().byId("tableId1");
                    oTable.removeItem(oEvent.getParameter("listItem"));
                } catch (error) {
                    console.error("Error in deleteRow:", error);
                    MessageBox.error("Error deleting row: " + error.message);
                }
            }
        });
    });