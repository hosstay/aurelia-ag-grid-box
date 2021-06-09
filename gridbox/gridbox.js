import {inject}  from 'aurelia-framework';

import {Grid} from 'ag-grid-community';
import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-fresh.css';
import 'ag-grid-enterprise';

import {DataLoader}       from '../../utility/data-loader';
import {errorHandler}     from '../../utility/utility';

/*
  Example:

  const grids = [];
  grids.push({
    name: 'ExampleGrid',
    headerName: 'Example Grid',
    columnDefs: columns,
    endpointToGetRowData: {
      prefix: 'api/protected/report/',
      endpoint: 'getExample',
      payload: {
        rowId: context.data.id
      }
    },
    exitButton: true,
    options: {
      customGridOptionsMod: (gridOptions) => {
        gridOptions.rowSelection = 'single';
        gridOptions.singleClickEdit = true;
      }
    }
  });

  this.example.grids = grids;
  await this.example.gridBox.startGridBox();

  const gridContext = this.example.gridBox.grids[0];

  gridContext.dblClickEventListener = (event) => {
    if (/col-id="changes"/.test(event.target.outerHTML)) {
      inputFormHandler(gridContext, 'changes');
    }
  };
  document.addEventListener('dblclick', gridContext.dblClickEventListener, true);
*/

@inject(DataLoader)
export class GridBox {
  constructor(dataLoader) {
    this.dataLoader = dataLoader;

    this.start = false;
    this.initialLoad = false;
    this.gridObj = {};
    this.loading = true;
    this.gridName = '';
    this.gridHeaderName = '';
    this.grids = [];
    this.currentGrid;
    this.columnDefs = [];
    this.gridOptions = {
      suppressColumnVirtualisation: true,
      sideBar: false,
      enableRangeSelection: true,
      defaultColDef: {
        filter: 'text',
        floatingFilter: true,
        resizable: true,
        filter: true,
        sortable: true
      }
    };
    this.isSwitchers = false;
    this.switchers = [];
    this.switcherEventListener = [];
    this.gridSwitcherUpdate = () => {};
    this.counter = -1;
    this.loadMessage;
    this.exitButton;
    this.exitEventListeners = [];
    this.genericButton;
    this.genericButtonEventListeners = [];
  }

  activate(params) {
    try {
      this.gridObj = params;

      this.gridObj.gridBox = this;

      if (this.initialLoad) this.attached();
      else this.initialLoad = true;
    } catch (err) {
      return errorHandler({err: err, context: 'GridBox - Activate', isLast: true});
    }
  }

  async attached() {
    // console.log('GridBox New - attached');
    // await this.gridSetup();

    // this.gridObj = JSON.parse(JSON.stringify(this.gridObj));
    // this.initialization();
    // for (let i = 0; i < this.grids.length; i++) {
    //   if (!this.grids[i].haltInitialLoad) await this.setup(this.grids[i]);
    // }

    // this.gridObj = JSON.parse(JSON.stringify(this.gridObj));
  }

  detached() {
    if (this.switcherEventListener.length) {
      document.removeEventListener('click', this.switcherEventListener[this.switcherEventListener.length - 1].func);
    }

    this.destroyAll();
  }

  async startGridBox() {
    const waitForGridDiv = () => {
      const poll = (resolve) => {
        // console.log('Waiting for grid div....');
        if (document.getElementById(this.gridName + '-grid-div')) resolve();
        else setTimeout(() => poll(resolve), 400);
      };

      return new Promise(poll);
    };

    this.gridName = this.gridObj.name;
    this.grids = this.gridObj.grids;
    if (this.gridObj.switchers) this.switchers = this.gridObj.switchers;

    await waitForGridDiv();

    for (let i = 0; i < this.grids.length; i++) {
      if (!this.grids[i].haltInitialLoad) {
        this.currentGrid = this.grids[i];
        await this.setup(this.grids[i], true);
      }
    }
  }

  async setup(grid, initial) {
    const waitForGridbox = () => {
      const poll = (resolve) => {
        // console.log('Waiting for hideGridBox class removal....');
        const gridBox = document.getElementById(this.gridName + '-grid-div');
        if (gridBox.nextSibling) resolve();
        else setTimeout(() => poll(resolve), 400);
      };

      return new Promise(poll);
    };

    try {
      // await this.setLoading(true); TODO ADD THIS BACK IN WITH NEW LOADING LOGIC
      if (grid.buildData) grid.rowData = grid.buildData;
      if (grid.buildPath) grid.endpointToGetRowData = grid.buildPath;

      if (grid.endpointToGetRowData) {
        // convert endPointToGetRowData to proper format if it isn't already
        if (typeof grid.endpointToGetRowData !== 'object') {
          if (typeof grid.endpointToGetRowData === 'string') {
            const match = grid.endpointToGetRowData.match(/([\w\/]+)\/([\w]+)/);

            if (match !== null) {
              grid.endpointToGetRowData = {
                prefix: match[1] + '/',
                endpoint: match[2]
              };

              console.log('endpointToGetRowData estimation from string:');
              console.log(grid.endpointToGetRowData);
            } else {
              console.log('Provided endpointToGetRowData:');
              console.log(grid.endpointToGetRowData);
              throw new Error(`endpointToGetRowData is not of correct form. Either needs to be object {prefix: '', endpoint: ''} or string 'prefix/endPoint' where the endPoint has no slashes`);
            }
          } else {
            console.log('Provided endpointToGetRowData:');
            console.log(grid.endpointToGetRowData);
            throw new Error(`endpointToGetRowData is not of correct form. Either needs to be object {prefix: '', endpoint: ''} or string 'prefix/endPoint' where the endPoint has no slashes`);
          }
        }

        if (grid.payload) grid.endpointToGetRowData.payload = grid.payload;
        if (grid.request) grid.endpointToGetRowData.payload = grid.request;
        if (grid.endpointToGetRowData.payload === undefined) grid.endpointToGetRowData.payload = {};

        grid.endpointToGetRowData.payload.timezone_offset = new Date().getTimezoneOffset() / 60;
      }

      this.start = true;

      if (!initial) {
        this.start = true;
        this.currentGrid = grid;
        this.grids.forEach((grid) => {
          if (grid.grid) {
            grid.gridOptions.api.destroy();
            if (grid.gridOptions.api) grid.gridOptions.api.destroy();
            delete grid.grid;
          }
        });
      }

      this.gridHeaderName = grid.headerName;

      let gridOptions;
      // if grid is already created (because it has context)
      if (grid.gridOptions && grid.gridOptions.context) {
        // use old gridOptions
        gridOptions = grid.gridOptions;
      } else {
        // if has custom gridOptions defined in its settings
        if (grid.gridOptions) {
          gridOptions = JSON.parse(JSON.stringify(grid.gridOptions));
        } else {
          // otherwise use default
          gridOptions = JSON.parse(JSON.stringify(this.gridOptions));
        }
      }

      grid.gridOptions = gridOptions;

      if (grid.disableFilter) {
        gridOptions.floatingFilter = false;
        grid.gridOptions = gridOptions;
      }

      if (grid.options && grid.options.customGridOptionsMod) {
        grid.options.customGridOptionsMod(gridOptions);
        grid.gridOptions = gridOptions;
      }

      grid.gridOptions.context = this;

      if (grid.columnDefs) {
        grid.gridOptions.columnDefs = grid.columnDefs;
      } else {
        throw new Error('Missing columnDefs!');
      }

      const gridBox = new Grid(document.getElementById(this.gridName + '-grid-div'), grid.gridOptions);
      grid.grid = gridBox;

      // Before doing anything else, wait for previous steps to finish
      await waitForGridbox();

      if (grid.rowData) {
        // Use the rowData to finish the rest of the grid
        grid.gridOptions.api.setRowData(grid.rowData);
        this.buildOptions(grid.options, {rowData: grid.rowData});
      } else if (grid.endpointToGetRowData) {
        // No rowData provided, use the endpoint given
        let response = await this.dataLoader.httpFetch(grid.endpointToGetRowData);

        // if response is an array (just the rowData returned) give it the correct response form
        if (response.length !== undefined) {
          response = {
            rowData: response
          };
        }
        grid.gridOptions.api.setRowData(response.rowData);
        this.buildOptions(grid.options, response);
      } else {
        const rowData = [];
        const row = {};
        grid.columnDefs.forEach((columnDef) => {
          row[columnDef.field] = '';
        });
        rowData.push(row);
        grid.gridOptions.rowData = rowData;
      }

      if (initial) {
        if (grid.exitButton) this.buildExitButton(grid.exitButton);
        else this.exitButton;

        if (this.switchers.length > 0) {
          this.switchers.forEach((switcher, i) => {
            this.buildGridSwitcherListener(i);
          });
        }
      }

      if (grid.button) this.buildGenericButton(grid.button);

      if (grid.autoSize !== false) {
        if (grid.autoSizeColDefs) {
          this.autoSizeAll(grid.gridOptions);
        } else {
          grid.gridOptions.api.sizeColumnsToFit();
        }
      }

      // await this.setLoading(false); TODO ADD THIS BACK IN WITH NEW LOADING LOGIC
      this.loading = false;
    } catch (err) {
      return errorHandler({err: err, context: 'GridBox - setup', isLast: true});
    }
  }

  buildOptions(options, obj) {
    if (!options) return;

    // if (options.minMaxButton) this.minMaxButton(grid);
    // if (options.rowStyle) this.rowStyler(grid);

    if (options.counter) {
      this.counter = obj.rowData.length;
    }

    if (options.loadMessage) {
      let message;

      if (options.loadMessage.message) {
        if (typeof options.loadMessage.message === 'string') {
          message = options.loadMessage.message;
        } else {
          message = options.loadMessage.message(obj);
        }
      } else if (obj.loadMessage) {
        message = obj.loadMessage;
      } else {
        message = obj.rowData.length + ' records loaded';
      }

      const loadMessageObj = {
        message: message,
        length: obj.rowData.length,
        position: options.loadMessage.position,
        filterDisabled: options.loadMessage.filterDisabled
      };

      if (options.loadMessage.type === 'blink') {
        this.loadMessageBlink(loadMessageObj);
      } else {
        this.loadMessageStatic(loadMessageObj);
      }
    }
  }

  autoSizeAll(gridOptions) {
    if (gridOptions.columnApi !== undefined) {
      const allColumnIds = [];

      gridOptions.columnApi.getAllColumns().forEach((column) => {
        allColumnIds.push(column.colId);
      });
      gridOptions.columnApi.autoSizeColumns(allColumnIds);
    }
  }

  async destroy(grid) {
    try {
      if (grid && grid.length) throw new Error('The grid passed into gridDestory is an array. Must be an object!');

      if (grid) grid.gridOptions.api.destroy();
    } catch (err) {
      return errorHandler({err: err, context: 'GridBox - Destroy', isLast: true});
    }
  }

  async destroyAll() {
    for (let i = 0; i < this.grids.length; i++) {
      if (this.grids[i] && this.grids[i].gridOptions) {
        if (this.grids[i].gridOptions.api) this.grids[i].gridOptions.api.destroy();
      }
    }
  }

  async gridRefresh(grid) {
    await this.setup(grid);
  }

  getRowData(gridOptions) {
    try {
      if (!gridOptions) throw new Error(`Undefined gridOptions`);
      const rowData = [];
      gridOptions.api.forEachNodeAfterFilterAndSort((node) => {
        rowData.push(node.data);
      });
      return rowData;
    } catch (err) {
      return errorHandler({err: err, context: 'getRowData'});
    }
  }

  setRowData(response) {
    try {
      if (response) {
        if (response.results) this.currentGrid.gridOptions.api.setRowData(response.results);
        if (response.loadMessage) {
          if (this.currentGrid.options) {
            if (this.currentGrid.options.loadMessage.type === 'blink') {
              this.loadMessageBlink(response.loadMessage, response.results.length, this.currentGrid.options.loadMessage.position);
            } else {
              this.loadMessageStatic(response.loadMessage, response.results.length, this.currentGrid.options.loadMessage.position);
            }
          } else {
            throw new Error(`Can't display load message because there is no loadMessage option.`);
          }
        }
      }
    } catch (err) {
      return errorHandler({err: err, context: 'GridBox - setRowData', isLast: true});
    }
  }

  refreshRowData(grid, data) {
    if (grid && data) grid.gridOptions.api.setRowData(data);
  }

  //  Additional Grid Features  //

  // loadMessage(grid, loadMessage) {
  loadMessageBlink(loadMessageObj) {
    // Currently blinks and then goes away
    // Make a loadMessage that is permanent
    if (loadMessageObj.message) {
      const message = document.getElementById(`${this.gridName}-${loadMessageObj.position ? `grid-label-${loadMessageObj.position}`:'grid-label-right'}`);
      message.classList.add('load-message-blink');
      document.getElementById(`${this.gridName}-${loadMessageObj.position ? `grid-label-${loadMessageObj.position}`:'grid-label-right'}`).innerHTML = loadMessageObj.message;

      setTimeout(() => {
        message.classList.remove('load-message-blink');
      }, 3000);

      setTimeout(() => {
        document.getElementById(`${this.gridName}-${loadMessageObj.position ? `grid-label-${loadMessageObj.position}`:'grid-label-right'}`).innerHTML = '';
      }, 8000);
    }
  }

  // loadMessageStatic(grid, loadMessage) {
  loadMessageStatic(loadMessageObj) {
    let newLoadMessage = loadMessageObj.message;

    if (!loadMessageObj.filterDisabled) {
      this.currentGrid.gridOptions.onFilterChanged = () => {
        const position = this.currentGrid.options.loadMessage.position;
        const elementId = `${this.gridName}-${position ? `grid-label-${position}`:'grid-label-right'}`;

        document.getElementById(elementId).innerHTML = loadMessageObj.message + ` (${this.currentGrid.gridOptions.api.getModel().rowsToDisplay.length} displayed)`;
      };

      newLoadMessage = `${loadMessageObj.message} (${loadMessageObj.length} displayed)`;
    }

    if (loadMessageObj.message) {
      const message = document.getElementById(`${this.gridName}-${loadMessageObj.position ? `grid-label-${loadMessageObj.position}`:'grid-label-right'}`);
      message.classList.add('load-message');

      document.getElementById(`${this.gridName}-${loadMessageObj.position ? `grid-label-${loadMessageObj.position}`:'grid-label-right'}`).innerHTML = newLoadMessage;
    } else {
      document.getElementById(`${this.gridName}-${loadMessageObj.position ? `grid-label-${loadMessageObj.position}`:'grid-label-right'}`).innerHTML = '';
    }
  }

  // Grid Switcher v3
  buildGridSwitcherListener(position) {
    this.isSwitchers = true;
    this.switcherEventListener.push({
      postition: position,
      func: this.switchers[position].func.bind(this),
      funcBind: this.switchers[position].funcBind ? this.switchers[position].funcBind : '',
      that: this.switchers[position].that ? this.switchers[position].that : ''
    });
    document.addEventListener('click', this.switcherEventListener[this.switcherEventListener.length - 1].func);

    this.gridObj.switcherEventListeners = this.switcherEventListener;
  }
  // Grid Switcher v3

  buildExitButton(exitButton) {
    if (!exitButton.position) {
      exitButton = {
        position: 'right'
      };
    }
    const label = document.getElementById(`${this.gridName}-${exitButton.position ? `grid-label-${exitButton.position}`:'grid-label-right'}`);
    if (exitButton.func) {
      // This will override default exit functionality
    } else {
      this.exitEventListeners.push({
        postition: this.exitEventListeners.length - 1,
        func: this.defaultExit
      });
      label.addEventListener('click', this.exitEventListeners[this.exitEventListeners.length - 1].func.bind(this));
    }
    this.exitButton = exitButton;
    this.gridObj.exitEventListeners = this.exitEventListeners;
  }

  defaultExit() {
    this.start = false;
    this.grids.forEach((grid) => {
      if (grid.grid) {
        grid.gridOptions.api.destroy();
        delete grid.grid;
      }
    });
  }

  buildGenericButton(button) {
    try {
      if (!button.position) button.position = 'right';

      if (button.classList && button.classList.length > 0) {
        button.classListString = button.classList.join(' ');
      } else {
        button.classListString = 'generic-grid-btn';
      }

      if (button.func) {
        this.genericButton = button;
        this.genericButton.gridBox = this;
      } else {
        throw new Error('A func key with a function must be in the button option');
      }
    } catch (err) {
      return errorHandler({err: err, context: 'buildGenericButton'});
    }
  }
}