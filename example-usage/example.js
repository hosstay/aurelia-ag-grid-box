import {inject} from 'aurelia-framework';

import {DataLoader} from '../../utility/data-loader';

@inject(DataLoader)
export class Example {
  constructor(dataLoader) {
    this.dataLoader = dataLoader;

    this.exampleTest = {
      name: 'example-test'
    };
  }

  async attached() {
    const columnDefs = [];
    columnDefs.push({headerName: 'id', field: 'id', width: 100});
    columnDefs.push({headerName: 'name', field: 'name', width: 60});

    const rowData = [];
    rowData.push({id: 1, name: 'bob'});
    rowData.push({id: 2, name: 'stan'});

    const grids = [];
    grids.push({
      name: 'exampleTestGrid',
      headerName: 'Example Test',
      columnDefs: columnDefs,
      rowData: rowData,
      exitButton: true
    });

    this.exampleTest.grids = grids;
    await this.exampleTest.gridBox.startGridBox();
  }
}