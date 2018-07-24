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
		this.projectId = project;
		this._milestoneComboStore = undefined;

		console.log('project:', project);
		this._milestoneCombo = Ext.widget('rallymilestonecombobox', {
			itemId: 'milestonecombobox',
			allowClear: true,
			multiSelect: true,
			width: 300,
			listeners: {
				change: function(combo) {
					//console.log('change: ', combo);
					console.log('change: ', combo.getValue());
					//console.log('store', this._milestoneComboStore);

					if (combo.getValue() && combo.getValue() != '' && combo.valueModels.length > 0) {						
						this.setLoading();

						var milestones = combo.valueModels;
						milestones.sort(
							function(a, b) {
								return a.get('TargetDate').getTime() - b.get('TargetDate').getTime();
							}
						);

						this.down('#bodyContainer').removeAll(true);
						for (var m of milestones) {
							this._buildMilestoneColumn(m);
						}
						//this._setFilter(combo.value);
						this._buildSummaryBoard(milestones);
					}
				},
				ready: function(combo) {
					//console.log('ready: ', combo.value);
					//console.log('store', this._milestoneComboStore);
					//this._setFilter(combo.value);
				},
				scope: this
			}
		});

		this._milestoneComboStore = this._milestoneCombo.getStore();

		this.down('#header').add([
		{
			xtype: 'panel',
			autoWidth: true,
			height: 120,
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
				}]
			},
			{
				xtype: 'panel',
				title: 'Summary',
				itemId: 'summaryPanel',
				bodyPadding: 10,
				//width: 450
				//layout: 'fit',
				flex: 7,
				align: 'stretch',
				autoHeight: true
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


	_applyMilestoneRangeFilter: function(initDate, endDate, store, scope) {
		//console.log(initDate, endDate, store, scope);
		if (initDate && !endDate) {
			this._milestoneComboStore.filterBy(function(record) {
				if (record.get('TargetDate')) {
					if (record.get('TargetDate').getTime() > initDate.getTime()) {
						return record;
					}
				}
			}, scope);

		} else if (endDate && !initDate) {
			this._milestoneComboStore.filterBy(function(record) {
				if (record.get('TargetDate')) {
					if (record.get('TargetDate').getTime() < endDate.getTime()) {
						return record;
					}
				}
			}, scope);
		} else if (initDate && endDate) {
			this._milestoneComboStore.filterBy(function(record) {
				if (record.get('TargetDate')) {
					if ((record.get('TargetDate').getTime() > initDate.getTime()) && 
						(record.get('TargetDate').getTime() < endDate.getTime())) {
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


	_setFilter: function(milestoneId) {
		this._filters = [{
			property: 'Milestones',
			operator: 'contains',
			//value: '/milestone/' + milestoneId
			value: milestoneId
		}];
		this._buildBoard();
	},


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
					'PlanEstimate',
					'PreliminaryEstimateValue',
					'LeafStoryPlanEstimateTotal', 
					'PercentDoneByStoryCount', 
					'PercentDoneByStoryPlanEstimate'],
			filters: [
				filter
			],
			limit: Infinity
		});


		featureStore.load().then({
			success: function(records) {
				//console.log('records', records);
				var that = this;

				if (records) {
					var summaryCard = this._buildSummaryCard(milestoneName, records);
					column.add(summaryCard);

					_.each(records, function(feature) {
						column.add(that._buildKanbanCard(feature));
					}, that);
				}

				this.setLoading(false);
			},
			scope: this
		});

		this.down('#bodyContainer').add(column);		
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
				'PercentDoneByStoryPlanEstimate'
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
	}
});
