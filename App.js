Ext.define('CustomApp', {
	extend: 'Rally.app.App',
	//extend: 'Rally.app.TimeboxScopedApp',
	//scopeType: 'milestone',
	componentCls: 'app',
	requires: [
		'Rally.ui.gridboard.plugin.GridBoardCustomFilterControl'
	],
	_cardBoard:undefined,
    _filters:undefined,
    _types:['PortfolioItem/Feature'],
    _initDate: undefined,
    _endDate: undefined,
    _milestoneType: undefined,
    _selectedMilestones: undefined,
    _filterPlannedStartDate: undefined,
    _filterPlannedEndDate: undefined,
    _filterParent: undefined,
    _filterParentFormattedID: undefined,
    _filterProject: undefined,
    _exportData: undefined,
    _exportButton: undefined,
    _projectStore: undefined,

    _myMask: undefined,

	items:[
        {
            xtype:'container',
            itemId:'header',
            cls:'header'
        },
        {
            xtype:'container',
            itemId:'bodyContainer',
            layout: {
		        type: 'hbox'
		    },
            height:'90%',
            width:'100%',
            autoScroll:true
        }
    ],


	launch: function() {
		var context = this.getContext();
		var project = context.getProject()['ObjectID'];
		console.log('project:', project);

		this.projectId = project;


		var projectStore = Ext.create('Rally.data.WsapiDataStore',{
	        model: 'Project',
	        limit : Infinity,
	        fetch: ['Name','ObjectID'],
	        autoLoad: true,
            sorters: [{
                property: 'Name',
                direction: 'ASC'
            }],
	        filters: 
	        	Rally.data.QueryFilter.or([
	        		{
                        property: 'Parent.ObjectID',
                        value: project
                    },
	                Rally.data.QueryFilter.or([
	                    {
	                        property: 'Parent.parent.ObjectID',
	                        value: project
	                    },
	                    {
	                        property: 'Parent.parent.parent.ObjectID',
	                        value: project
	                    }   
	                ])
                ]),

	        listeners:{
	            load: function(store,records,success) {
	            	console.log('projects', records);

	            	var localRecords = [];
	            	localRecords.push({
                    	_refName: '-- No Entry --',
                    	Name: ''
                    });

	            	_.each(records, function(project) {
                        localRecords.push({
                        	_refName: project.get('Name'),
                        	Name: project.get('Name')
                        });
                    });

                    var customProjectStore = Ext.create('Ext.data.Store', {
			    		fields: ['_refName', 'Name'],
					    data : localRecords
					});

                    console.log('projectStore:', customProjectStore);

	                this._updateCombo(customProjectStore);
	                this._buildGrid();
	            },
	            scope: this
	        }
    	});		
	},



	_buildGrid: function() {
		this._milestoneComboStore = undefined;
		this._milestoneCombo = Ext.widget('rallymilestonecombobox', {
			itemId: 'milestonecombobox',
			allowClear: true,
			multiSelect: true,
			width: 300,
			listeners: {
				afterrender: function(combobox) {
					combobox.disable();
				},
				beforerender: function(combo) {
					console.log('beforerender: ', combo);
					this._blockFilters();

					//console.log('store', this._milestoneComboStore);
					//this._setFilter(combo.value);
				},
				ready: function(combo) {
					console.log('ready: ', combo.value);
					this._unBlockFilters();
					combo.refreshStore();
					combo.enable();
					//console.log('store', this._milestoneComboStore);
					//this._setFilter(combo.value);
				},
				change: function(combo) {
					//console.log('change: ', combo);
					console.log('change: ', combo.getValue());
					//console.log('store', this._milestoneComboStore);

					if (combo.getValue() && combo.getValue() != '' && combo.valueModels.length > 0) {
						var milestones = combo.valueModels;
						milestones.sort(
							function(a, b) {
								return a.get('TargetDate').getTime() - b.get('TargetDate').getTime();
							}
						);

						this._selectedMilestones = milestones;

						this._doSearch(milestones);
					} else {
						this._applyMilestoneRangeFilter(this._initDate, this._endDate, this._milestoneComboStore, this);
					}
				},
				scope: this
			}
		});

		this._milestoneComboStore = this._milestoneCombo.getStore();

		this.down('#header').add([
		{
			xtype: 'panel',
			autoWidth: true,
			//height: 120,
			layout: 'hbox',

			items: [{
				xtype: 'panel',
				title: 'Choose date range for milestone:',
				//width: 450,
				//layout: 'fit',
				flex: 3,
				align: 'stretch',
				autoHeight: true,
				bodyPadding: 10,
				items: [{
					xtype: 'datefield',
					anchor: '100%',
			        fieldLabel: 'From',
					scope: this,
		        	listeners : {
		        		change: function(picker, newDate, oldDate) {
		        			this._initDate = newDate;
		        			var that = this;

		        			//console.log('Store:', this._milestoneComboStore);
		        			this._applyMilestoneRangeFilter(this._initDate, this._endDate, this._milestoneComboStore, that);
		        		},
		        		scope:this
		        	}
				}, {
					xtype: 'datefield',
					anchor: '100%',
			        fieldLabel: 'To',
					scope: this,
		        	listeners : {
		        		change: function(picker, newDate, oldDate) {
		        			this._endDate = newDate;
		        			var that = this;

		        			//console.log('Store:', this._milestoneComboStore);
		        			this._applyMilestoneRangeFilter(this._initDate, this._endDate, this._milestoneComboStore, that);
		        		},
		        		scope:this
		        	}
				}, {					
			        xtype: 'rallyfieldvaluecombobox',
			        fieldLabel: 'Milestone Types',
			        model: 'Milestone',
			        field: 'c_Type',
			        scope: this,
			        listeners: {
			        	change: function(combo) {
							console.log('Milestone type: ', combo.getValue());
							//console.log('store', this._milestoneComboStore);

							this._milestoneType = combo.getValue();

							this._applyMilestoneRangeFilter(this._initDate, this._endDate, this._milestoneComboStore, this, this._milestoneType);
						},
						scope: this
			        }
				},
				{
					xtype: 'rallycheckboxfield',
					fieldLabel: 'Extra Filters:',
					itemId: 'extraFilters',
					listeners : {
		        		change: function(checkbox, newValue, oldValue) {
		        			console.log('value check:', newValue);

		        			if (newValue) {
		        				this._showExtraFilters();
		        			} else {
		        				this._hideExtraFilters();
		        			}
		        		},
		        		scope:this
		        	}
				},
				{
					xtype: 'panel',
					itemId: 'extraFiltersPanel',
					layout: 'hbox',
					hidden: true,
					align: 'stretch',
					bodyPadding: 10,
					items: [{
						xtype: 'datefield',
				        fieldLabel: 'Planned Start Date',
				        margin: '0 15 0 0',
						scope: this,
			        	listeners : {
			        		change: function(picker, newDate, oldDate) {
			        			this._filterPlannedStartDate = newDate;
			        			// var that = this;

			        			//console.log('Store:', this._milestoneComboStore);
			        		},
			        		scope:this
			        	}
					},
					{
						xtype: 'datefield',
				        fieldLabel: 'Planned End Date',
				        margin: '0 15 0 0',
						scope: this,
			        	listeners : {
			        		change: function(picker, newDate, oldDate) {
			        			this._filterPlannedEndDate = newDate;
			        			// var that = this;

			        			//console.log('Store:', this._milestoneComboStore);
			        		},
			        		scope:this
			        	}
					},
					{
				        xtype: 'rallytextfield',
				        fieldLabel: 'Parent',
				        margin: '0 15 0 0',
				        scope: this,
				        listeners : {
			        		change: function(textField, newValue, oldValue) {
			        			this._filterParent = newValue;
			        			// var that = this;

			        			console.log('filter parent:', this._filterParent);
			        		},
			        		scope:this
			        	}

				    },
				    {
				        xtype: 'rallytextfield',
				        fieldLabel: 'Parent ID',
				        margin: '0 15 0 0',
				        scope: this,
				        listeners : {
			        		change: function(textField, newValue, oldValue) {
			        			this._filterParentFormattedID = newValue;
			        			// var that = this;

			        			console.log('filter parent FormattedID:', this._filterParentFormattedID);
			        		},
			        		scope:this
			        	}

				    },
				    {	
				    	xtype: 'combobox',
				        fieldLabel: 'Project',
				        store: this._projectStore,
				        queryMode: 'local',
				        displayField: '_refName',
				        valueField: 'Name',
				        margin: '0 15 0 0',
				        anyMatch: true,
				        listeners: {
				            select: function(combo,records){
				                //console.log(records[0]["data"]["Name"]);
				                console.log('project: ', combo.getValue());
				                this._filterProject = combo.getValue();
				            },
				        	scope:this
				        },
				        scope:this
				    },
				    {
				        xtype: 'rallybutton',
				        text: 'Apply Filter',
				        margin: '0 15 0 0',
				        scope: this,
				        handler: function() {
			        		console.log('Apply filter', this._selectedMilestones);
			        		if (this._selectedMilestones) {
			        			this._doSearch(this._selectedMilestones);
			        		}
			        	}
				    }]
				}]
			}]
		},
		{
			xtype: 'fieldcontainer',
			fieldLabel: 'Milestone',
			pack: 'end',
			labelAlign: 'right',
			items: [
				this._milestoneCombo
			]
		}]);
	},



	_blockFilters: function() {
		this.down('#header').disable();
	},


	_unBlockFilters: function() {
		this.down('#header').enable();
	},


	_hideExtraFilters: function() {
		this.down('#extraFiltersPanel').hide();
	},


	_showExtraFilters: function() {
		this.down('#extraFiltersPanel').show();
	},


	_updateCombo: function(myStore){
    	if (this._projectStore === undefined){
	        this._projectStore = myStore;
	    }
	},


	_doSearch: function(milestones) {
		this.setLoading();
		this.down('#bodyContainer').removeAll(true);

		this._exportData = new Ext.util.MixedCollection();

		var promises = [];
		for (var m of milestones) {
			promises.push(this._buildMilestoneColumn(m));
		}


		Deft.Promise.all(promises).then({
			success: function(records) {
				this.setLoading(false);

				var rows = this._convertExportDataToJson(this._exportData);


				if (!this._exportButton) {
					this._exportButton = this._createExportButton(rows);
		        	this.down('#header').add(this._exportButton);
				} else {
					this.down('#header').remove(this._exportButton);
					this._exportButton = this._createExportButton(rows);
		        	this.down('#header').add(this._exportButton);
				}                             
            },
            scope: this
		});
		//this._setFilter(combo.value);
		//this._buildSummaryBoard(milestones);
	},


	_createExportButton: function(rows) {
		var button = Ext.create('Rally.ui.Button', {
        	text: 'Export',
        	margin: '10 10 10 10',
        	scope: this,
        	handler: function() {
        		var csv = this._convertToCSV(rows);
        		console.log('converting to csv:', csv);


        		//Download the file as CSV
		        var downloadLink = document.createElement("a");
		        var blob = new Blob(["\ufeff", csv]);
		        var url = URL.createObjectURL(blob);
		        downloadLink.href = url;
		        downloadLink.download = "report.csv";  //Name the file here
		        document.body.appendChild(downloadLink);
		        downloadLink.click();
		        document.body.removeChild(downloadLink);
        	}
        });

		return button;
	},


	_applyMilestoneRangeFilter: function(initDate, endDate, store, scope, milestoneType) {
		//console.log(initDate, endDate, store, scope);
		if (initDate && !endDate && !milestoneType) {
			this._milestoneComboStore.filterBy(function(record) {
				if (record.get('TargetDate')) {
					if (record.get('TargetDate').getTime() > initDate.getTime()) {
						return record;
					}
				}
			}, scope);

		} else if (endDate && !initDate && !milestoneType) {
			this._milestoneComboStore.filterBy(function(record) {
				if (record.get('TargetDate')) {
					if (record.get('TargetDate').getTime() < endDate.getTime()) {
						return record;
					}
				}
			}, scope);
		} else if (initDate && endDate && !milestoneType) {
			this._milestoneComboStore.filterBy(function(record) {
				if (record.get('TargetDate')) {
					if ((record.get('TargetDate').getTime() > initDate.getTime()) && 
						(record.get('TargetDate').getTime() < endDate.getTime())) {
						return record;
					}
				}
			}, scope);
		} else if (initDate && !endDate && milestoneType) {
			this._milestoneComboStore.filterBy(function(record) {
				if (record.get('TargetDate')) {
					if (record.get('TargetDate').getTime() > initDate.getTime() &&
						(record.get('c_Type') === this._milestoneType)) {
						return record;
					}
				}
			}, scope);
		} else if (!initDate && endDate && milestoneType) {
			this._milestoneComboStore.filterBy(function(record) {
				if (record.get('TargetDate')) {
					if (record.get('TargetDate').getTime() < initDate.getTime() &&
						(record.get('c_Type') === this._milestoneType)) {
						return record;
					}
				}
			}, scope);
		} else if (!initDate && !endDate && milestoneType) {
			this._milestoneComboStore.filterBy(function(record) {
				if (record.get('c_Type') && (record.get('c_Type') === this._milestoneType) ) {
					return record;
				}
			}, scope);
		} else if (endDate && initDate && milestoneType) {
			this._milestoneComboStore.filterBy(function(record) {
				if (record.get('TargetDate')) {
					if (record.get('TargetDate').getTime() < endDate.getTime() &&
						(record.get('TargetDate').getTime() > initDate.getTime()) &&
						(record.get('c_Type') === this._milestoneType)) {
						return record;
					}
				}
			}, scope);
		} else {
			this._milestoneComboStore.filterBy(function(record) {				
				return record;
			});
		}
	},


	//NOT USED
	_setFilter: function(milestoneId) {
		this._filters = [{
			property: 'Milestones',
			operator: 'contains',
			//value: '/milestone/' + milestoneId
			value: milestoneId
		}];
		this._buildBoard();
	},


	//NOT USED
	_buildBoard: function() {
		if (this._filters === undefined) {
			return;
		}

		this.setLoading();
		if (this._cardBoard !== undefined) {
			this.down('#bodyContainer').remove(this._cardBoard);
		}

		var context = this.getContext();
		var modelNames = ['PortfolioItem/Feature'];


		this._cardBoard = Ext.widget('rallygridboard', {
			//modelNames: modelNames,
			//attribute: 'State',
			types: this._types,
			itemId: 'cardboard',
			name: 'cardboard',
			context: context,
			toggleState: 'board',
			stateful: false,
			
			listeners: {
				load: function(board, eOpts) {
					//console.log('Board', board);
					this.setLoading(false);
				},
				scope: this
			},

			storeConfig: {
				filters: this._filters
			},
			// cardConfig: {
            //              editable: false,
   			//              fields: this._getDefaultFields(),
   			//              pointField: 'PreliminaryEstimateValue'
   			//          },
            // rowConfig: {
            //     field: 'Project'
            // },
			cardBoardConfig: {
				attribute: 'State',
				columnConfig: {
					columnStatusConfig: {
						pointField: 'PreliminaryEstimateValue'
					},
					fields: this._getDefaultFields()
				},
				rowConfig: {
					field: 'Project'
				},
			},
			plugins: [{
				ptype: 'rallygridboardinlinefiltercontrol',
				inlineFilterButtonConfig: {
					margin: '3 9 3 30',
					stateful: true,
					stateId: context.getScopedStateId('filters'),
					modelNames: modelNames,
					inlineFilterPanelConfig: {
						quickFilterPanelConfig: {
							defaultFields: [
								'ArtifactSearch',
								'Owner',
								'State'
							]
						}
					}
				}
			}]
		});
		//this.setLoading(false);
		this.down('#bodyContainer').add(this._cardBoard);
	},


	_buildMilestoneColumn: function(milestone) {
		//console.log('milestone', milestone);
		var deferred = Ext.create('Deft.Deferred');

		var targetDate = milestone.get('TargetDate');
		var milestoneId = milestone.get('ObjectID');
		var milestoneTag = milestone.get('_ref');
		var milestoneName = milestone.get('Name');

		var colId = 'milestone-'+milestoneId;
		var colName = targetDate.toLocaleDateString();

		//console.log(colId, colName);

		var column = Ext.create('Ext.panel.Panel', {
			title: 'Target Date: '+ colName,
			width: 320,
            layout: {
                type: 'vbox',                
                padding: 5
            },
            padding: 5,
            itemId: colId
		});

		var filter = {
			property: 'Milestones',
			operator: 'contains',
			value: milestoneTag
		};

		var boxExtraFilter = this.down('#extraFilters');
		if (boxExtraFilter.value) {
			console.log('using extraFilters');

			if (this._filterPlannedStartDate) {
				filter = Rally.data.QueryFilter.and([
						filter,
					{
						property: 'PlannedStartDate',
						operator: '>=',
						value: this._filterPlannedStartDate
					}
				]);
			}

			if (this._filterPlannedEndDate) {
				filter = Rally.data.QueryFilter.and([
						filter,
					{
						property: 'PlannedEndDate',
						operator: '<=',
						value: this._filterPlannedEndDate
					}
				]);
			}


			if (this._filterProject) {
				filter = Rally.data.QueryFilter.and([
						filter,
					{
						property: 'Project.Name',
						value: this._filterProject
					}
				]);
			}

			if (this._filterParent) {
				filter = Rally.data.QueryFilter.and([
						filter,
					{
						property: 'Parent.Name',
						operator: 'contains',
						value: this._filterParent
					}
				]);
			}

			if (this._filterParentFormattedID) {
				filter = Rally.data.QueryFilter.and([
						filter,
					{
						property: 'Parent.FormattedID',
						operator: '=',
						value: this._filterParentFormattedID
					}
				]);
			}
		}
		

		console.log('filter:', filter);


		var featureStore = Ext.create('Rally.data.wsapi.artifact.Store', {
			context: {
		        projectScopeUp: false,
		        projectScopeDown: true,
		        project: null //null to search all workspace
		    },
			models: ['PortfolioItem/Feature', 'Defect', 'TestSet'],
			fetch: ['FormattedID', 
					'Name', 
					'Owner', 
					'ObjectID', 
					'Project', 
					'State', 
					'Type', 
					'Tags', 
					'Parent',
					'Requirement',
					'PlanEstimate',
					'PreliminaryEstimateValue',
					'LeafStoryPlanEstimateTotal', 
					'PercentDoneByStoryCount', 
					'PercentDoneByStoryPlanEstimate',
					'c_BusinessPriority',
					'DisplayColor',
					'WSJFScore'],
			filters: [
				filter
			],
			limit: Infinity
		});


		featureStore.load().then({
			success: function(records) {
				console.log('records', records);
				var that = this;

				if (records) {
					var bpSorter = this._createBPColumnSorter(colId);
					column.add(bpSorter);
					var wsjfSorter = this._createWSJFColumnSorter(colId);
					column.add(wsjfSorter);

					var summaryCard = this._buildSummaryCard(milestoneName, records);
					column.add(summaryCard);

					var featuresArray = [];
					var exportFeature = {
						milestoneName: milestoneName, 
						milestoneId: milestoneId,
						featuresArray: featuresArray
					};

					_.each(records, function(feature) {
						column.add(that._buildKanbanCard(feature));

						var planEstimate;
						var parent;
						var preliminaryEstimateValue;

						if (feature.get('_type') == 'portfolioitem/feature') {
							planEstimate = feature.get('LeafStoryPlanEstimateTotal');
							parent = feature.get('Parent').Name;
							preliminaryEstimateValue = feature.get('PreliminaryEstimateValue');
						} else {
							planEstimate = feature.get('PlanEstimate');
							parent = feature.get('Requirement') ? feature.get('Requirement').Name : '';
							preliminaryEstimateValue = '';
						}

						var featureExp = {
							id : feature.get('FormattedID'),
							description : feature.get('Name'),
							planEstimate : planEstimate,
							parent: parent,
							project: feature.get('Project').Name,
							score: feature.get('WSJFScore'),
							businessPriority: feature.get('c_BusinessPriority'),
							preliminaryEstimateValue: preliminaryEstimateValue
						};

						exportFeature.featuresArray.push(featureExp);

					}, that);

					this._exportData.add(milestoneId, exportFeature);

					//console.log(' export:', this._exportData);
				}

				deferred.resolve();
				//this.setLoading(false);
			},
			scope: this
		});

		this.down('#bodyContainer').add(column);

		return deferred.promise;
	},


	_createBPColumnSorter: function(colId) {
		var lbl2 = new Ext.panel.Panel({
			width: 110,
			height: 22,
			id: colId + "sorter1",
			html: "Business Priority &#x2B06;&#x2B07; ",
			baseCls: "custom-cursor",
			order: true,
			listeners: {
				render: function(c) {
					c.getEl().on({
						click: function() {
							var panel = Ext.ComponentQuery.query('#'+colId)[0];

							var sortedItems = this._sortItemsByBusinessPriority(panel.items, c.order);
							c.order = !c.order;

							var sorter1 = panel.items.getAt(0); 
							var sorter2 = panel.items.getAt(1); 
							var summary = panel.items.getAt(2); 
							panel.removeAll(false);


							panel.add(sorter1);
							panel.add(sorter2);
							panel.add(summary);

							panel.add(sortedItems);

							panel.doLayout();
						},
						scope: this
					});
				},
				afterrender: function(){
                   Ext.QuickTips.init();
                   Ext.QuickTips.register({
                     target: colId + "sorter1",
                     text: 'Sort cards based on Business Priority',
                     width: 240,
                     dismissDelay: 2000
                   }) ;
                },
                destroy:function(){
                   Ext.QuickTips.destroy();
                },
				scope:this
			}
		});

		return lbl2;
	},


	_sortItemsByBusinessPriority: function(items, order) {
		var sortedItems;
		var unsortedItems = [];

		//console.log('items:', order, items);

		//start at 3 for the 2 sorters plus the summary box
		for (var i = 3; i < items.length; i++) {
			//pushing all cards to an array
			unsortedItems.push(items.getAt(i));
		}

		if (order) {
			sortedItems = unsortedItems.sort( function(a,b) {
				var itema = a.getRecord().get('c_BusinessPriority');
				var itemb = b.getRecord().get('c_BusinessPriority');

				if (itema < itemb) {
					return -1;
				} else if (itema > itemb) {
					return 1;
				} else {
					return 0;
				}
			});
		} else {
			sortedItems = unsortedItems.sort( function(a,b) {
				var itema = a.getRecord().get('c_BusinessPriority');
				var itemb = b.getRecord().get('c_BusinessPriority');

				if (itema > itemb) {
					return -1;
				} else if (itema < itemb) {
					return 1;
				} else {
					return 0;
				}
			});
		}

		//console.log('sorted:', sortedItems);
		return sortedItems;
	},


	_createWSJFColumnSorter: function(colId) {
		var lbl2 = new Ext.panel.Panel({
			width: 45,
			height: 22,
			id: colId + "sorter2",
			html: "WSJF &#x2B06;&#x2B07;",
			baseCls: "custom-cursor",
			order: true,		
			listeners: {
				render: function(c) {
					c.getEl().on({
						click: function() {
							var panel = Ext.ComponentQuery.query('#'+colId)[0];

							var sortedItems = this._sortItemsByWSJFScore(panel.items, c.order);
							c.order = !c.order;

							var sorter1 = panel.items.getAt(0); 
							var sorter2 = panel.items.getAt(1); 
							var summary = panel.items.getAt(2); 
							panel.removeAll(false);


							panel.add(sorter1);
							panel.add(sorter2);
							panel.add(summary);

							panel.add(sortedItems);

							panel.doLayout();
						},
						scope: this
					});
				},
				afterrender: function(){
                   Ext.QuickTips.init();
                   Ext.QuickTips.register({
                     target: colId + "sorter2",
                     text: 'Sort cards based on WSJF',
                     width: 180,
                     dismissDelay: 2000
                   }) ;
                },
                destroy:function(){
                   Ext.QuickTips.destroy();
                },
				scope:this
			}
		});

		return lbl2;
	},


	_sortItemsByWSJFScore: function(items, order) {
		var sortedItems;
		var unsortedItems = [];

		//console.log('items:', order, items);

		//start at 3 for the 2 sorters plus the summary box
		for (var i = 3; i < items.length; i++) {
			//pushing all cards to an array
			unsortedItems.push(items.getAt(i));
		}

		if (order) {
			sortedItems = unsortedItems.sort( function(a,b) {
				var itema = a.getRecord().get('WSJFScore');
				var itemb = b.getRecord().get('WSJFScore');

				if (itema < itemb) {
					return -1;
				} else if (itema > itemb) {
					return 1;
				} else {
					return 0;
				}
			});
		} else {
			sortedItems = unsortedItems.sort( function(a,b) {
				var itema = a.getRecord().get('WSJFScore');
				var itemb = b.getRecord().get('WSJFScore');

				if (itema > itemb) {
					return -1;
				} else if (itema < itemb) {
					return 1;
				} else {
					return 0;
				}
			});
		}

		//console.log('sorted:', sortedItems);
		return sortedItems;
	},


	_buildSummaryCard: function(milestoneName, records) {
		var totalFeaturePoints = 0;
		var totalLeafStoryPoints = 0;
		var totalDefectsPoints = 0;

		_.each(records, function(feature) {
			var type = feature.get('_type'); 
			if (type == 'portfolioitem/feature') {
				totalFeaturePoints += feature.get('PreliminaryEstimateValue');
				totalLeafStoryPoints += feature.get('LeafStoryPlanEstimateTotal');
			} else {
				totalDefectsPoints += feature.get('PlanEstimate');
			}
		});

		var summaryCard = Ext.widget('propertygrid', {
			title: milestoneName + ' summary:',
			hideHeaders: true, 
			nameColumnWidth: 200,
			padding: '0 0 20 15' ,
			width: 280,
			source: {
                    'Total Feature Pts': totalFeaturePoints,
                    'Total Leaf Story Pts': totalLeafStoryPoints,
                    'Total Defect PTs' : totalDefectsPoints
            },
		});

		return summaryCard;
	},


	_buildKanbanCard: function(record) {
		var card = Ext.widget('rallycard', {
			itemId: record.get('FormattedID'),
			config: {
				record: record
			},
			fields: [ 
				'Name',
				'Owner',
				'FormattedID',
				'Tags',
				'Project',
				'Parent',
				'LeafStoryPlanEstimateTotal',
				'PercentDoneByStoryPlanEstimate',
				'c_BusinessPriority',
				'WSJFScore'
			],
			width: 280,
			record: record
		});

		return card;
	},


	//NOT BEING USED RIGHT NOW, but could be used in future stories.
	_buildSummaryBoard: function(milestones) {
		var milestonesTag = [];
		for (var m of milestones) {
			milestonesTag.push(m.get('_ref'));
		}

		//console.log('tags', milestonesTag);

		var filter;

		if (milestonesTag.length == 1) {
			filter = {
		        property: 'Milestones',
		        operator: 'contains',
		        value: milestonesTag[0]
		    };
		} else if (milestonesTag.length == 2) {
			filter = Rally.data.wsapi.Filter.or([
			    {
			        property: 'Milestones',
			        operator: 'contains',
			        value: milestonesTag[0]
			    },
			    {
			        property: 'Milestones',
			        operator: 'contains',
			        value: milestonesTag[1]
			}]);
		} else if (milestonesTag.length > 2) {
			filter = Rally.data.wsapi.Filter.or([
			    {
			        property: 'Milestones',
			        operator: 'contains',
			        value: milestonesTag[0]
			    },
			    {
			        property: 'Milestones',
			        operator: 'contains',
			        value: milestonesTag[1]
			}]);

			milestonesTag = _.last(milestonesTag, milestonesTag.length - 2);
			//console.log('after last:', milestonesTag);

			for (var tag of milestonesTag) {
				filter = Rally.data.wsapi.Filter.or([
				    filter,
				    {
				        property: 'Milestones',
				        operator: 'contains',
				        value: tag
					}]);
			}
		}


		//console.log('filter: ', filter.toString());


		var featureStore = Ext.create('Rally.data.wsapi.artifact.Store', {
			context: {
		        projectScopeUp: false,
		        projectScopeDown: true,
		        project: null //null to search all workspace
		    },
			models: ['PortfolioItem/Feature'],
			fetch: ['FormattedID', 'Name', 'ObjectID', 'Project', 'State', 'LeafStoryPlanEstimateTotal'],
			filters: filter,
			limit: Infinity
		});


		featureStore.load().then({
			success: function(records) {
				//console.log('milestone records:', records);
				//generate grid

				var map = new Ext.util.MixedCollection();

				var columns = [];
				var columnNames = [];
				var data = {
					'ProjectName': 'LeafStoryPlanEstimateTotal'
				};

				_.each(records, function(feature) {
					var projectName = feature.get('Project').Name;
					if (!map.containsKey(projectName)) {
						var leafStoryPlanEstimateTotal = feature.get('LeafStoryPlanEstimateTotal');
						map.add(projectName, leafStoryPlanEstimateTotal);
					} else {
						var leafTotal = map.get(projectName);
						leafTotal += feature.get('LeafStoryPlanEstimateTotal');
						map.replace(projectName, leafTotal);
					}
				});

				map.eachKey(function(projectName, leafStoryPlanEstimateTotal) {
        			columns.push({
						text: projectName,
						dataIndex: projectName
					});
					columnNames.push(projectName);

					data[projectName] = leafStoryPlanEstimateTotal;
        		});

        		var grid = Ext.create('Ext.grid.Panel', {
					columns: columns,
					flex: 1,
					//title: 'Summary',
					store: {
						fields: columnNames,
						data: data
					}
				});

				this.down('#summaryPanel').removeAll(true);
				this.down('#summaryPanel').add(grid);
			},
			scope: this
		});

	},


	_getDefaultFields: function() {
		return ['Discussion', 'PreliminaryEstimate', 'UserStories', 'Milestones'];
	},



	_convertToCSV: function(objArray) {
		// console.log('csv entry:', objArray);
		var fields = Object.keys(objArray[0]);

		var replacer = function(key, value) { return value === null ? '' : value; };
		var csv = objArray.map(function(row){
		  return fields.map(function(fieldName) {
		    return JSON.stringify(row[fieldName], replacer);
		  }).join(',');
		});

		csv.unshift(fields.join(',')); // add header column

		//console.log(csv.join('\r\n'));

		return csv.join('\r\n');
    },


    _convertExportDataToJson: function(exportData) {
    	var data = [];

    	//console.log('converting to export for csv:', exportData);

    	exportData.eachKey(function(milestoneId, milestoneFeatures) {
            //console.log('item:', milestoneFeatures);
    		var milestoneName = milestoneFeatures.milestoneName;

    		_.each(milestoneFeatures.featuresArray, function(feature) {
	    		data.push({
	    			milestoneName: milestoneName,
	    			featureNumber: feature.id,
	    			featureDescription: feature.description,
	    			planEstimate: feature.planEstimate,
	    			parent: feature.parent,
	    			project: feature.project,
	    			score: feature.score,
	    			businessPriority: feature.businessPriority,
	    			preliminaryEstimateValue: feature.preliminaryEstimateValue
	    		});
    		}, this);          
        }, 
        this);

    	//console.log('convertion complete:', data);

    	return data;
    }


});
