import { listenToTriggers } from '@ng-bootstrap/ng-bootstrap/util/triggers';
import { search } from '@ngrx/router-store';
import { distinctUntilKeyChanged } from 'rxjs/operator/distinctUntilKeyChanged';
import { distinct } from 'rxjs/operator/distinct';
import { Viewer, ViewerModel } from '../../store/model/viewer.model';
import { ViewerAction } from '../../store/action/viewer.action';
import {AfterViewInit, ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
import { Observable } from 'rxjs/Observable';
import {map} from 'rxjs/operator/map';
import {debounceTime} from 'rxjs/operator/debounceTime';
import {distinctUntilChanged} from 'rxjs/operator/distinctUntilChanged';
import {MapService} from '../../services/map.service';
import {FileService} from '../../services/files.service';
// import {NgbSlideEvent} from '@ng-bootstrap/ng-bootstrap';
import {ChartService} from '../../services/chart.service';
import {Subscription} from 'rxjs/Subscription';
import {Store} from '@ngrx/store';
import {AppStore} from '../../store/default.store';
import * as enablePassiveEvent from 'default-passive-events/default-passive-events.js';

@Component({
  selector: 'app-viewer',
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.css']
  // changeDetection: ChangeDetectionStrategy.Default
})
export class ViewerComponent implements OnInit, OnDestroy, AfterViewInit {
  public countryUIList: Array<any> = [];
  public countryListComp: Array<any> = [];
  public countryListIsoCodes: Array<any> = [];
  public getOutputDataSubs: Subscription;
  public global = true;
  public hazards = {
    hazard1: true,
    hazard2: true,
    hazard3: true,
    hazard4: true
  };
  public legends: Array<any> = [];
  public mapSlideUISelected = 'socio';
  public MAX_COUNTRIES_SELECTED = 2;
  public _selectedCountryList: Array<any> = [];
  public sliderValues1Default = {};
  public sliderValues2Default = {};
  public sliderValues1 = {};
  public sliderValues2 = {};
  public viewerDisplay = true;
  public viewerModel: Viewer = {
    firstCountry: '',
    secondCountry: ''
  };
  public viewerP1Default: any = {};
  public viewerP2Default: any = {};
  public viewerP1: ViewerModel = {
    name: '',
    macro_gdp_pc_pp: 0,
    macro_pop: 0,
    macro_urbanization_rate: 0,
    macro_prepare_scaleup: 0,
    macro_borrow_abi: 0,
    macro_avg_prod_k: 0,
    macro_T_rebuild_K: 0,
    macro_pi: 0,
    macro_income_elast: 0,
    macro_rho: 0,
    macro_shareable: 0,
    macro_max_increased_spending: 0,
    macro_fa_glofris: 0,
    macro_protection: 0,
    macro_tau_tax: 0,
    n_cat_info__nonpoor: 0,
    n_cat_info__poor: 0,
    c_cat_info__nonpoor: 0,
    c_cat_info__poor: 0,
    axfin_cat_info__nonpoor: 0,
    axfin_cat_info__poor: 0,
    gamma_SP_cat_info__nonpoor: 0,
    gamma_SP_cat_info__poor: 0,
    k_cat_info__nonpoor: 0,
    k_cat_info__poor: 0,
    fa_cat_info__nonpoor: 0,
    fa_cat_info__poor: 0,
    v_cat_info__nonpoor: 0,
    v_cat_info__poor: 0,
    shew_cat_info__nonpoor: 0,
    shew_cat_info__poor: 0,
    shew_for_hazard_ratio: 0,
    hazard_ratio_fa__earthquake: 0,
    hazard_ratio_fa__flood: 0,
    hazard_ratio_fa__surge: 0,
    hazard_ratio_fa__tsunami: 0,
    hazard_ratio_fa__wind: 0,
    hazard_ratio_flood_poor: 0,
    ratio_surge_flood: 0,
    risk: 0,
    resilience: 0,
    risk_to_assets: 0,
    id: '',
    group_name: ''
  };
  public viewerP2: ViewerModel = {
    name: '',
    macro_gdp_pc_pp: 0,
    macro_pop: 0,
    macro_urbanization_rate: 0,
    macro_prepare_scaleup: 0,
    macro_borrow_abi: 0,
    macro_avg_prod_k: 0,
    macro_T_rebuild_K: 0,
    macro_pi: 0,
    macro_income_elast: 0,
    macro_rho: 0,
    macro_shareable: 0,
    macro_max_increased_spending: 0,
    macro_fa_glofris: 0,
    macro_protection: 0,
    macro_tau_tax: 0,
    n_cat_info__nonpoor: 0,
    n_cat_info__poor: 0,
    c_cat_info__nonpoor: 0,
    c_cat_info__poor: 0,
    axfin_cat_info__nonpoor: 0,
    axfin_cat_info__poor: 0,
    gamma_SP_cat_info__nonpoor: 0,
    gamma_SP_cat_info__poor: 0,
    k_cat_info__nonpoor: 0,
    k_cat_info__poor: 0,
    fa_cat_info__nonpoor: 0,
    fa_cat_info__poor: 0,
    v_cat_info__nonpoor: 0,
    v_cat_info__poor: 0,
    shew_cat_info__nonpoor: 0,
    shew_cat_info__poor: 0,
    shew_for_hazard_ratio: 0,
    hazard_ratio_fa__earthquake: 0,
    hazard_ratio_fa__flood: 0,
    hazard_ratio_fa__surge: 0,
    hazard_ratio_fa__tsunami: 0,
    hazard_ratio_fa__wind: 0,
    hazard_ratio_flood_poor: 0,
    ratio_surge_flood: 0,
    risk: 0,
    resilience: 0,
    risk_to_assets: 0,
    id: '',
    group_name: ''
  };
  public viewer$: Observable<Viewer>;
  public viewerModel1$: Observable<ViewerModel>;
  public viewerModel2$: Observable<ViewerModel>;
  public viewerSubs: Subscription;
  public viewerModel1Subs: Subscription;
  public viewerModel2Subs: Subscription;
  private onPassEv = e => { /*e.preventDefault();*/ };
  public searchCountryFn = (text$: Observable<string>) => {
    const debounceTimeFn = debounceTime.call(text$, 200);
    const distinctUntilChangedFn = distinctUntilChanged.call(debounceTimeFn);
    const searchCb = term => {
      if (!term.length) {
        return [];
      } else {
        return this.countryUIList.filter(v => v.toLowerCase().indexOf(term.toLowerCase()) > -1).slice(0, 10);
      }
    };
    return map.call(distinctUntilChangedFn, searchCb);
  }

  constructor(
    private mapService: MapService,
    private chartService: ChartService,
    private store: Store<AppStore>,
    private fileService: FileService) {
      this.viewer$ = store.select('viewer');
      this.viewerModel1$ = store.select('viewerModel1');
      this.viewerModel2$ = store.select('viewerModel2');
    }
  // LIFE-CYCLE METHODS
  ngOnInit() {
    this.mapService.createMap('map');
    this.setMapConf();
    // this.addElPassiveEvents();
  }
  ngOnDestroy() {
    this.getOutputDataSubs.unsubscribe();
    this.viewerSubs.unsubscribe();
    this.viewerModel1Subs.unsubscribe();
    this.viewerModel2Subs.unsubscribe();
    // this.removeElPassiveEvents();
  }
  ngAfterViewInit() {
    this.setViewerObservableConf();
    this.setViewerModel1ObservableConf();
    this.setViewerModel2ObservableConf();
  }
  // METHODS
  private _changeCountryInput(isFirstInput) {
    const input = isFirstInput ? this.viewerModel.firstCountry : this.viewerModel.secondCountry;
    const fromListFilter = this.countryListComp.filter(
      val => val.name.toLowerCase() === input.toLowerCase());
    const MAX_SELECTED_COUNTRIES = 2;
    if (this._selectedCountryList.length <= MAX_SELECTED_COUNTRIES) {
      if (isFirstInput) {
        this._filterCountryByInput(fromListFilter, 0, this.viewerModel.firstCountry);
      } else {
        this._filterCountryByInput(fromListFilter, 1, this.viewerModel.secondCountry);
      }
      this.store.dispatch({type: ViewerAction.EDIT_VIEWER, payload: this.viewerModel});
    }
  }
  private _changeSliderValue(key, isFirstInput) {
    const sliderObj = isFirstInput ? this.sliderValues1 : this.sliderValues2;
    const inputIdx = isFirstInput ? 0 : 1;
    const viewerMod = isFirstInput ? this.viewerP1 : this.viewerP2;
    const viewerActionStr = isFirstInput ? 'EDIT_VIEWER_MODEL_1' : 'EDIT_VIEWER_MODEL_2';
    const outputChartId = isFirstInput ? 'outputs-1' : 'outputs-2';
    const countryArr = this._selectedCountryList.filter(country => {
      return country.index === inputIdx;
    });
    if (countryArr.length) {
      const globalObj = this.chartService.getGlobalModelData();
      const selectedCtr = globalObj[countryArr[0].code];
      jQuery.each(selectedCtr, (idx, glob) => {
        if (viewerMod[idx] === 0 && glob > viewerMod[idx]) {
          viewerMod[idx] = glob;
        }
      });
      // Apply proper slider values from selected country
      jQuery.each(viewerMod, (viewKey, model) => {
        if (sliderObj.hasOwnProperty(viewKey)) {
          viewerMod[viewKey] = sliderObj[viewKey].value;
        }
      });
      viewerMod[key] = sliderObj[key].value;
      viewerMod['name'] = countryArr[0].name;
      viewerMod['id'] = countryArr[0].code;
      viewerMod['group_name'] = countryArr[0].group;
      this.chartService.getInputPModelData(viewerMod).subscribe(data => {
        const newObj = {};
        for (const dataK in data) {
          if (data.hasOwnProperty(dataK)) {
            newObj[dataK] = data[dataK][viewerMod['name']];
          }
        }
        this.chartService.updateOutputCharts(outputChartId, {model: newObj}, 'GLOBAL');
      });
      this.store.dispatch({type: ViewerAction[viewerActionStr], payload: viewerMod});
    }
  }
  private _filterCountryByInput(list, selectedIdx, field) {
    const inData = this.chartService.getInputData();
    const outData = this.chartService.getOutputData();
    const idOut = selectedIdx === 0 ? 'outputs-1' : 'outputs-2';
    const idInSoc = selectedIdx === 0 ? 'inputSoc-1' : 'inputSoc-2';
    const idInEco = selectedIdx === 0 ? 'inputEco-1' : 'inputEco-2';
    const idInExp = selectedIdx === 0 ? 'inputExp-1' : 'inputExp-2';
    const idInVul = selectedIdx === 0 ? 'inputVul-1' : 'inputVul-2';
    const sliderValues = selectedIdx === 0 ? this.sliderValues1 : this.sliderValues2;
    if (list.length) {
      const filterExistence = this._selectedCountryList.filter(val => {
        return val.name === list[0].name;
      });
      if (!filterExistence.length) {
        this._selectedCountryList.push({
          index: selectedIdx,
          name: list[0].name,
          code: list[0].code,
          group: list[0].group
        });
        if (this.global) {
          this.chartService.updateOutputCharts(idOut, list[0].code);
          this.chartService.updateInputCharts(idInSoc, sliderValues, list[0].code);
          this.chartService.updateInputCharts(idInEco, sliderValues, list[0].code);
          this.chartService.updateInputCharts(idInExp, sliderValues, list[0].code);
          this.chartService.updateInputCharts(idInVul, sliderValues, list[0].code);
        } else {
          this.chartService.createOutputChart(outData, idOut, list[0].group, false, list[0].code);
          this.chartService.createInputCharts(inData, idInSoc, sliderValues, list[0].group);
          this.chartService.createInputCharts(inData, idInEco, sliderValues, list[0].group);
          this.chartService.createInputCharts(inData, idInExp, sliderValues, list[0].group);
          this.chartService.createInputCharts(inData, idInVul, sliderValues, list[0].group);

        }
        this.mapService.setMapFilterByISOCode(list[0].code);
      }
    } else {
      const filterIndex = this._selectedCountryList.map((val, index) => {
        if (val.index === selectedIdx) {
          return index;
        }
      }).filter(isFinite);
      if (filterIndex.length) {
        const filterIndexFromAll = this.countryListComp.filter(val => {
          return val.name === this._selectedCountryList[filterIndex[0]].name;
        });
        if (filterIndex.length > 0 && filterIndexFromAll.length > 0 &&
          field.toLowerCase() !== this._selectedCountryList[filterIndex[0]].name.toLowerCase()) {
          this.mapService.setMapFilterByISOCode(filterIndexFromAll[0].code);
          if (this.global) {
            this.chartService.updateOutputCharts(idOut, 'global');
            this.chartService.updateInputCharts(idInSoc, sliderValues, 'global');
            this.chartService.updateInputCharts(idInEco, sliderValues, 'global');
            this.chartService.updateInputCharts(idInExp, sliderValues, 'global');
            this.chartService.updateInputCharts(idInVul, sliderValues, 'global');
          } else {
            this.chartService.createOutputChart(outData, idOut, 'GLOBAL');
            this.chartService.updateOutputCharts(idOut, 'global');
            if (!this.global) {
              this.global = !this.global;
            }
            if (selectedIdx === 1 && this.viewerModel.firstCountry) {
              const filterCountryVal1 = this.countryListComp.filter(val =>
                val.name.toLowerCase() === this.viewerModel.firstCountry.toLowerCase());
              if (filterCountryVal1.length) {
                this.chartService.createOutputChart(outData, 'outputs-1', 'GLOBAL');
                this.chartService.updateOutputCharts('outputs-1', filterCountryVal1[0].code);
              }
            }  else if (selectedIdx === 0 && this.viewerModel.secondCountry) {
              const filterCountryVal2 = this.countryListComp.filter(val =>
                val.name.toLowerCase() === this.viewerModel.secondCountry.toLowerCase());
              if (filterCountryVal2.length) {
                this.chartService.createOutputChart(outData, 'outputs-2', 'GLOBAL');
                this.chartService.updateOutputCharts('outputs-2', filterCountryVal2[0].code);
              }
            }
            this.chartService.createInputCharts(inData, idInSoc, sliderValues, 'GLOBAL');
            this.chartService.createInputCharts(inData, idInEco, sliderValues, 'GLOBAL');
            this.chartService.createInputCharts(inData, idInExp, sliderValues, 'GLOBAL');
            this.chartService.createInputCharts(inData, idInVul, sliderValues, 'GLOBAL');
          }
          this._selectedCountryList.splice(filterIndex[0], 1);
        }
      }
    }
  }
  addElPassiveEvents() {
    const options: any = {passive: true};
    document.addEventListener('touchstart', this.onPassEv, options);
    document.addEventListener('touchmove', this.onPassEv, options);
    document.addEventListener('wheel', this.onPassEv, options);
    document.addEventListener('wheelmove', this.onPassEv, options);
  }
  changeCountryInputsByClick(isoCode) {
    const filterISOCode = this.countryListComp.filter(val => val.code === isoCode);
    if (filterISOCode.length > 0) {
      this.mapService.setMapFilterByISOCode(isoCode);
      const filteredName = filterISOCode[0].name;
      const filteredGroup = filterISOCode[0].group;
      const selectedCountryIdx = this._selectedCountryList.map((val, index) => {
        if (val.name.toLowerCase() === filteredName.toLowerCase()) {
          return index;
        }
      }).filter(isFinite);
      const MAX_SELECTED_COUNTRIES = 2;
      const inData = this.chartService.getInputData();
      const outData = this.chartService.getOutputData();
      if (selectedCountryIdx.length === 0) {
        let index = 0;
        const filterCountryVal1 = this.countryListComp.filter(val =>
          val.name.toLowerCase() === this.viewerModel.firstCountry.toLowerCase());
        const filterCountryVal2 = this.countryListComp.filter(val =>
          val.name.toLowerCase() === this.viewerModel.secondCountry.toLowerCase());
        if (!this.viewerModel.firstCountry || filterCountryVal1.length === 0) {
          this.viewerModel.firstCountry = filteredName;
          if (this.global) {
            this.chartService.updateOutputCharts('outputs-1', isoCode);
            this.chartService.updateInputCharts('inputSoc-1', this.sliderValues1, isoCode);
            this.chartService.updateInputCharts('inputEco-1', this.sliderValues1, isoCode);
            this.chartService.updateInputCharts('inputExp-1', this.sliderValues1, isoCode);
            this.chartService.updateInputCharts('inputVul-1', this.sliderValues1, isoCode);
          } else {
            this.chartService.createOutputChart(outData, 'outputs-1', filteredGroup, false, isoCode);
            this.chartService.createInputCharts(inData, 'inputSoc-1', this.sliderValues1, filteredGroup);
            this.chartService.createInputCharts(inData, 'inputEco-1', this.sliderValues1, filteredGroup);
            this.chartService.createInputCharts(inData, 'inputExp-1', this.sliderValues1, filteredGroup);
            this.chartService.createInputCharts(inData, 'inputVul-1', this.sliderValues1, filteredGroup);
          }
        } else if (!this.viewerModel.secondCountry.trim() || filterCountryVal2.length === 0) {
          index += 1;
          this.viewerModel.secondCountry = filteredName;
          if (this.global) {
            this.chartService.updateOutputCharts('outputs-2', isoCode);
            this.chartService.updateInputCharts('inputSoc-2', this.sliderValues2, isoCode);
            this.chartService.updateInputCharts('inputEco-2', this.sliderValues2, isoCode);
            this.chartService.updateInputCharts('inputExp-2', this.sliderValues2, isoCode);
            this.chartService.updateInputCharts('inputVul-2', this.sliderValues2, isoCode);
          } else {
            this.chartService.createOutputChart(outData, 'outputs-2', filteredGroup, false, isoCode);
            this.chartService.createInputCharts(inData, 'inputSoc-2', this.sliderValues2, filteredGroup);
            this.chartService.createInputCharts(inData, 'inputEco-2', this.sliderValues2, filteredGroup);
            this.chartService.createInputCharts(inData, 'inputExp-2', this.sliderValues2, filteredGroup);
            this.chartService.createInputCharts(inData, 'inputVul-2', this.sliderValues2, filteredGroup);
          }
        }
        if (this._selectedCountryList.length < MAX_SELECTED_COUNTRIES) {
          this._selectedCountryList.push({
            index: index,
            name: filteredName,
            code: isoCode,
            group: filteredGroup
          });
        }
      } else {
        const selectedC = this._selectedCountryList[selectedCountryIdx[0]].name;
        if (this.viewerModel.firstCountry.length && selectedC.indexOf(this.viewerModel.firstCountry) >= 0) {
          this.viewerModel.firstCountry = '';
          if (this.global) {
            this.chartService.updateOutputCharts('outputs-1', 'global');
            this.chartService.updateInputCharts('inputExp-1', this.sliderValues1, 'global');
            this.chartService.updateInputCharts('inputSoc-1', this.sliderValues1, 'global');
            this.chartService.updateInputCharts('inputEco-1', this.sliderValues1, 'global');
            this.chartService.updateInputCharts('inputVul-1', this.sliderValues1, 'global');
          } else {
            this.chartService.createOutputChart(outData, 'outputs-1', 'GLOBAL');
            this.chartService.updateOutputCharts('outputs-1', 'global');
            if (!this.global) {
              this.global = !this.global;
            }
            if (this.viewerModel.secondCountry) {
              const filterCountryVal2 = this.countryListComp.filter(val =>
                val.name.toLowerCase() === this.viewerModel.secondCountry.toLowerCase())[0];
              this.chartService.createOutputChart(outData, 'outputs-2', 'GLOBAL');
              this.chartService.updateOutputCharts('outputs-2', filterCountryVal2.code);
            }
            this.chartService.createInputCharts(inData, 'inputSoc-1', this.sliderValues1, 'GLOBAL');
            this.chartService.createInputCharts(inData, 'inputEco-1', this.sliderValues1, 'GLOBAL');
            this.chartService.createInputCharts(inData, 'inputExp-1', this.sliderValues1, 'GLOBAL');
            this.chartService.createInputCharts(inData, 'inputVul-1', this.sliderValues1, 'GLOBAL');
          }
        } else if (this.viewerModel.secondCountry.length && selectedC.indexOf(this.viewerModel.secondCountry) >= 0) {
          this.viewerModel.secondCountry = '';
          if (this.global) {
            this.chartService.updateOutputCharts('outputs-2', 'global');
            this.chartService.updateInputCharts('inputExp-2', this.sliderValues2, 'global');
            this.chartService.updateInputCharts('inputSoc-2', this.sliderValues2, 'global');
            this.chartService.updateInputCharts('inputEco-2', this.sliderValues2, 'global');
            this.chartService.updateInputCharts('inputVul-2', this.sliderValues2, 'global');
          } else {
            this.chartService.createOutputChart(outData, 'outputs-2', 'GLOBAL');
            this.chartService.updateOutputCharts('outputs-2', 'global');
            if (!this.global) {
              this.global = !this.global;
            }
            if (this.viewerModel.firstCountry) {
              const filterCountryVal1 = this.countryListComp.filter(val =>
                val.name.toLowerCase() === this.viewerModel.firstCountry.toLowerCase())[0];
              this.chartService.createOutputChart(outData, 'outputs-1', 'GLOBAL');
              this.chartService.updateOutputCharts('outputs-1', filterCountryVal1.code);
            }
            this.chartService.createInputCharts(inData, 'inputSoc-2', this.sliderValues2, 'GLOBAL');
            this.chartService.createInputCharts(inData, 'inputEco-2', this.sliderValues2, 'GLOBAL');
            this.chartService.createInputCharts(inData, 'inputExp-2', this.sliderValues2, 'GLOBAL');
            this.chartService.createInputCharts(inData, 'inputVul-2', this.sliderValues2, 'GLOBAL');
          }
        }
        this._selectedCountryList.splice(selectedCountryIdx[0], 1);
      }
      this.store.dispatch({type: ViewerAction.EDIT_VIEWER, payload: this.viewerModel});
    }
  }
  getChartOutputData() {
    this.chartService.initOutputChartConf();
    this.getOutputDataSubs = this.chartService.getOutputDataObs().subscribe(data => {
      this.chartService.setInputData(data._globalModelData).then((inputData) => {
        this.chartService.createInputCharts(inputData, 'inputSoc-1', this.sliderValues1);
        this.chartService.createInputCharts(inputData, 'inputSoc-2', this.sliderValues2);
        this.chartService.createInputCharts(inputData, 'inputEco-1', this.sliderValues1);
        this.chartService.createInputCharts(inputData, 'inputEco-2', this.sliderValues2);
        this.chartService.createInputCharts(inputData, 'inputExp-1', this.sliderValues1);
        this.chartService.createInputCharts(inputData, 'inputExp-2', this.sliderValues2);
        this.chartService.createInputCharts(inputData, 'inputVul-1', this.sliderValues1);
        this.chartService.createInputCharts(inputData, 'inputVul-2', this.sliderValues2);
        this.setSliderConfValues(inputData);
      });
      this.chartService.createOutputChart(data._outputDomains, 'outputs-1');
      this.chartService.createOutputChart(data._outputDomains, 'outputs-2');
      this.countryUIList = this.chartService.getOutputDataUIList();
      this.countryListComp = this.chartService.getOutputList();
      this.countryListIsoCodes = this.countryListComp.map(val => val.code);
      this.mapService.setMapFilterByISOCodes(this.countryListIsoCodes);
    }, err => {
      console.log(err);
    });
  }
  private processForFileJSONData(isPDF?: boolean): any {
    const outputData = this.chartService.getOutputData();
    const chartConf = this.chartService.getChartsConf();
    const inputData = this.chartService.getInputData();
    const inputTypes = chartConf.inputTypes;
    const firstInput = this.viewerModel.firstCountry;
    const secondInput = this.viewerModel.secondCountry;
    const data: any = {
      country1: {
        name: '',
        outputs: {},
        inputs: {}
      },
      country2: {
        name: '',
        outputs: {},
        inputs: {}
      },
      selectedHazards: {
        hazard1: this.hazards.hazard1,
        hazard2: this.hazards.hazard2,
        hazard3: this.hazards.hazard3,
        hazard4: this.hazards.hazard4
      }
    };
    if (isPDF) {
      data.map = {
        chart: document.querySelector('canvas').toDataURL(),
        type: this.mapSlideUISelected
      };
    }
    data.page = this.viewerDisplay ? 'viewer' : 'tech';
    const countryFInput = this._selectedCountryList.filter(val => {
      return val.name.toLowerCase() === firstInput.toLowerCase();
    });
    const countrySInput = this._selectedCountryList.filter(val => {
      return val.name.toLowerCase() === secondInput.toLowerCase();
    });
    data.country1.name = !firstInput || countryFInput.length === 0 ? 'Global' : firstInput;
    data.country2.name = !secondInput || countrySInput.length === 0 ? 'Global' : secondInput;
    jQuery.each(outputData, (key, out) => {
      if (!data.country1.outputs[key]) {
        data.country1.outputs[key] = {};
      }
      if (!data.country2.outputs[key]) {
        data.country2.outputs[key] = {};
      }
      data.country1.outputs[key]['value'] = out.chart['outputs-1'];
      data.country1.outputs[key]['label'] = out.descriptor;
      data.country2.outputs[key]['value'] = out.chart['outputs-2'];
      data.country2.outputs[key]['label'] = out.descriptor;
      if (isPDF) {
        const chObj = this.chartService.formatSVGChartBase64Strings(key, true);
        data.country1.outputs[key]['chart'] = chObj.chart1;
        data.country2.outputs[key]['chart'] = chObj.chart2;
      }
    });
    jQuery.each(inputTypes, (key, inputT) => {
      if (!data.country1.inputs[key]) {
        data.country1.inputs[key] = {};
      }
      if (!data.country2.inputs[key]) {
        data.country2.inputs[key] = {};
      }
      inputT.forEach(inpKey => {
        const label = inputData.filter(val => {
          return val.key === inpKey;
        })[0].descriptor;
        if (!data.country1.inputs[key][inpKey]) {
          data.country1.inputs[key][inpKey] = {};
        }
        if (!data.country2.inputs[key][inpKey]) {
          data.country2.inputs[key][inpKey] = {};
        }
        data.country1.inputs[key][inpKey]['label'] = label;
        data.country2.inputs[key][inpKey]['label'] = label;

        data.country1.inputs[key][inpKey]['value'] = this.sliderValues1[inpKey + '_display_value'];
        data.country2.inputs[key][inpKey]['value'] = this.sliderValues2[inpKey + '_display_value'];
        if (data.page === 'viewer') {
          data.country1.inputs[key][inpKey]['value'] = this.sliderValues1[inpKey].value;
          data.country2.inputs[key][inpKey]['value'] = this.sliderValues2[inpKey].value;
        }

        if (isPDF) {
          if (data.page === 'viewer') {
            const chObj = this.chartService.formatSVGChartBase64Strings(key, false, inpKey);
            data.country1.inputs[key][inpKey]['chart'] = chObj.chart1;
            data.country2.inputs[key][inpKey]['chart'] = chObj.chart2;
          } else {
            data.country1.inputs[key][inpKey]['min'] = this.sliderValues1[inpKey]['min'];
            data.country1.inputs[key][inpKey]['max'] = this.sliderValues1[inpKey]['max'];
            data.country2.inputs[key][inpKey]['min'] = this.sliderValues2[inpKey]['min'];
            data.country2.inputs[key][inpKey]['max'] = this.sliderValues2[inpKey]['max'];
          }
        }
      });
    });
    return data;
  }
  private removeElPassiveEvents() {
    document.removeEventListener('touchstart', this.onPassEv);
    document.removeEventListener('touchmove', this.onPassEv);
    document.removeEventListener('wheel', this.onPassEv);
    document.removeEventListener('wheelmove', this.onPassEv);
  }
  setMapConf() {
    const self = this;
    this.mapService.addStylesOnMapLoading(() => {
      this.mapService.addBasemap();
      this.legends = this.mapService.getMapLegendConf('socio');
      this.mapService.setMapFilterByISOCodes(this.countryListIsoCodes);
      this.getChartOutputData();
      this.mapService.setClickFnMapEvent((ev) => {
        const features = self.mapService.getMap().queryRenderedFeatures(ev.point, {layers: [self.mapService.getViewerFillLayer()]});
        if (features.length) {
          const isoCode = features[0].properties['ISO_Codes'];
          const isoCodeList = this.countryListIsoCodes.filter(val => val === isoCode);
          if (isoCodeList.length) {
            self.changeCountryInputsByClick(isoCode);
          }
        }
      });
    });
  }
  setSingleSliderConfValue(sliderObj, key, max, min, input) {
    sliderObj[key + '_min'] = 1;
    sliderObj[key + '_max'] = 100;
    sliderObj[key + '_step'] = 1;
    if (sliderObj[key + '_display_value'] != null) {
      sliderObj[key + '_value'] = sliderObj[key + '_display_value'] / (max + min) * 100;
      sliderObj[key + '_display_value'] =
        this.chartService.formatInputChartValues(sliderObj[key + '_display_value'], input);
      sliderObj[key + '_original_value'] =
        parseFloat(sliderObj[key + '_display_value'].replace('$', '').replace(',', ''));
    } else {
      sliderObj[key + '_value'] = 50;
      sliderObj[key + '_original_value'] = 50;
      sliderObj[key + '_display_value'] =
        this.chartService.formatInputChartValues((max + min) / 2, input);
    }
  }
  setSliderConfValues(inputData) {
    for (const inputDataIndex in inputData) {
      if (inputData.hasOwnProperty(inputDataIndex)) {
        const key = inputData[inputDataIndex].key;
        let min = inputData[inputDataIndex].distribGroupArr[0].distribution;
        let max = inputData[inputDataIndex].distribGroupArr[0].distribution;
        for (let index = 1; index < inputData[inputDataIndex].distribGroupArr.length; index++) {
          const valueInput = inputData[inputDataIndex].distribGroupArr[index].distribution;
          if (valueInput > max) {
            max = valueInput;
          }
          if (valueInput < min) {
            min = valueInput;
          }
        }
        if (min === max) {
          min--;
          max++;
        }
        this.setSingleSliderConfValue(this.sliderValues1, key, max, min, inputData[inputDataIndex]);
        this.setSingleSliderConfValue(this.sliderValues2, key, max, min, inputData[inputDataIndex]);
        this.viewerP1[key] =
          (key === 'macro_T_rebuild_K' || key === 'k_cat_info__poor' || key === 'k_cat_info__nonpoor') ?
            this.sliderValues1[key + '_original_value'] : this.sliderValues1[key + '_original_value'] / 100;
        this.viewerP2[key] =
          (key === 'macro_T_rebuild_K' || key === 'k_cat_info__poor' || key === 'k_cat_info__nonpoor') ?
            this.sliderValues2[key + '_original_value'] : this.sliderValues2[key + '_original_value'] / 100;
        this.sliderValues1[key] = {
          min: min,
          max: max,
          value: this.sliderValues1[key + '_value']
        };
        this.sliderValues2[key] = {
          min: min,
          max: max,
          value: this.sliderValues2[key + '_value']
        };
      }
    }
    this.viewerP1Default = Object.assign({}, this.viewerP1);
    this.viewerP2Default = Object.assign({}, this.viewerP2);
    this.sliderValues1Default = Object.assign({}, this.sliderValues1);
    this.sliderValues2Default = Object.assign({}, this.sliderValues2);
  }
  setViewerObservableConf() {
    this.viewerSubs = this.viewer$.subscribe(state => {
      if (state) {
        this.viewerModel = state;
      }
    });
  }
  setViewerModel1ObservableConf() {
    this.viewerModel1Subs = this.viewerModel1$.subscribe(state => {
      if (state) {
        this.viewerP1 = state;
      }
    });
  }
  setViewerModel2ObservableConf() {
    this.viewerModel2Subs = this.viewerModel2$.subscribe(state => {
      if (state) {
        this.viewerP2 = state;
      }
    });
  }
  // EVENTS
  onDownloadCSVViewerReportEvent() {
    const data = this.processForFileJSONData();
    this.fileService.getViewerCSVFile(data).subscribe(csvData => {
      const blob = new Blob(['\ufeff', csvData]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('download', 'viewer_report.csv');
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
    });
  }
  onDownloadPDFViewerReportEvent() {
    const data = this.processForFileJSONData(true);
    console.log(data);
    this.fileService.getViewerPDFFile(data).subscribe(pdfData => {
      const byteString = window.atob(pdfData);
      // Convert that text into a byte array.
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ia], {
        type: 'application/octet-stream;'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      document.body.appendChild(a);
      a.href = url;
      a.download = 'viewer_report.pdf';
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
    });
  }
  onFirstCountryInputChangeEvent() {
    this._changeCountryInput(true);
  }
  onResetTechDataEvent() {
    // Reset values
    this.viewerModel.firstCountry = '';
    this.viewerModel.secondCountry = '';
    this.viewerP1 = Object.assign({}, this.viewerP1Default);
    this.viewerP2 = Object.assign({}, this.viewerP2Default);
    this.sliderValues1 = Object.assign({}, this.sliderValues1Default);
    this.sliderValues2 = Object.assign({}, this.sliderValues2Default);
    // Update states
    this.store.dispatch({type: ViewerAction.EDIT_VIEWER, payload: this.viewerModel});
    this.store.dispatch({type: ViewerAction.EDIT_VIEWER_MODEL_1, payload: this.viewerP1});
    this.store.dispatch({type: ViewerAction.EDIT_VIEWER_MODEL_2, payload: this.viewerP2});
    // Update charts
    this.chartService.updateOutputCharts('outputs-1', 'global');
    this.chartService.updateOutputCharts('outputs-2', 'global');
    // Update map data
    if (this._selectedCountryList.length) {
      this._selectedCountryList.forEach(val => {
        this.mapService.setMapFilterByISOCode(val.code);
      });
      this._selectedCountryList = [];
    }
  }
  onSecondCountryInputChangeEvent() {
    this._changeCountryInput(false);
  }
  onDisplayTechMapViewEvent() {
    if (!this.global) {
      this.global = !this.global;
      const outData = this.chartService.getOutputData();
      this._selectedCountryList.forEach(country => {
        const chartIndex = country.index === 0 ? '1' : '2';
        this.chartService.createOutputChart(outData, `outputs-${chartIndex}`, 'GLOBAL', false, country.code);
        this.chartService.updateOutputCharts(`outputs-${chartIndex}`, country.code);
      });
    }
  }
  onSlideChangeEvent($event) {
    let currentSlideId = $event.current;
    currentSlideId = currentSlideId.split('-')[0];
    this.mapSlideUISelected = currentSlideId;
    const layerPaintProp = 'fill-color';
    this.mapService.changeLayerStyle({
      property: layerPaintProp,
      type: currentSlideId
    });
    const currentLegend = this.mapService.getMapPaintConf(currentSlideId);
    this.legends = this.mapService.getMapLegendConf(currentSlideId);
  }
  onSwitchGlobal() {
    if (this._selectedCountryList.length === this.MAX_COUNTRIES_SELECTED) {
      this.global = !this.global;
      const inData = this.chartService.getInputData();
      const outData = this.chartService.getOutputData();
      this._selectedCountryList.forEach(country => {
        const group = this.global ? 'GLOBAL' : country.group;
        if (country.index === 0) {
          this.chartService.createOutputChart(outData, 'outputs-1', group, false, country.code);
          this.chartService.createInputCharts(inData, 'inputSoc-1', this.sliderValues1, group);
          this.chartService.createInputCharts(inData, 'inputEco-1', this.sliderValues1, group);
          this.chartService.createInputCharts(inData, 'inputExp-1', this.sliderValues1, group);
          this.chartService.createInputCharts(inData, 'inputVul-1', this.sliderValues1, group);
          this.chartService.updateInputCharts('inputExp-1', this.sliderValues1, country.code);
          this.chartService.updateInputCharts('inputSoc-1', this.sliderValues1, country.code);
          this.chartService.updateInputCharts('inputEco-1', this.sliderValues1, country.code);
          this.chartService.updateInputCharts('inputVul-1', this.sliderValues1, country.code);
          if (this.global) {
            this.chartService.updateOutputCharts('outputs-1', country.code);
          }
        }
        if (country.index === 1) {
          this.chartService.createOutputChart(outData, 'outputs-2', group, false, country.code);
          this.chartService.createInputCharts(inData, 'inputSoc-2', this.sliderValues2, group);
          this.chartService.createInputCharts(inData, 'inputEco-2', this.sliderValues2, group);
          this.chartService.createInputCharts(inData, 'inputExp-2', this.sliderValues2, group);
          this.chartService.createInputCharts(inData, 'inputVul-2', this.sliderValues2, group);
          this.chartService.updateInputCharts('inputExp-2', this.sliderValues2, country.code);
          this.chartService.updateInputCharts('inputSoc-2', this.sliderValues2, country.code);
          this.chartService.updateInputCharts('inputEco-2', this.sliderValues2, country.code);
          this.chartService.updateInputCharts('inputVul-2', this.sliderValues2, country.code);
          if (this.global) {
            this.chartService.updateOutputCharts('outputs-2', country.code);
          }
        }
      });
    }
  }
  onSwitchExposure() {
  }
  onSwitchExposure1() {
    this.hazards.hazard1 = !this.hazards.hazard1;
    this.onSwitchExposure();
  }
  onSwitchExposure2() {
    this.hazards.hazard2 = !this.hazards.hazard2;
    this.onSwitchExposure();
  }
  onSwitchExposure3() {
    this.hazards.hazard3 = !this.hazards.hazard3;
    this.onSwitchExposure();
  }
  onSwitchExposure4() {
    this.hazards.hazard4 = !this.hazards.hazard4;
    this.onSwitchExposure();
  }
  onSliderChangeEvent(sliderValues, key) {
    const inputObj = this.chartService.getInputData();
    const input = inputObj.filter(val => val.key === key)[0];
    const newValue = (sliderValues[key].max + sliderValues[key].min) / 100 * sliderValues[key + '_value'];
    sliderValues[key + '_display_value'] = this.chartService.formatInputChartValues(newValue, input);
    sliderValues[key + '_original_value'] =
      parseFloat(sliderValues[key + '_display_value'].replace('$', '').replace(',', ''));
    sliderValues[key].value = newValue;
  }
  onSliderChangeEvent1(key) {
    this.onSliderChangeEvent(this.sliderValues1, key);
    this._changeSliderValue(key, true);
  }
  onSliderChangeEvent2(key) {
    this.onSliderChangeEvent(this.sliderValues2, key);
    this._changeSliderValue(key, false);
  }
}
