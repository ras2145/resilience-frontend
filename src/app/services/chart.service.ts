import { Injectable, Output } from '@angular/core';
import {Observable} from 'rxjs/Rx';
import {Subscription} from 'rxjs/Subscription';
import 'rxjs/add/observable/fromPromise';
import * as d3 from 'd3/d3.js';
import * as science from 'science/index.js';
import * as d3Q from 'd3-queue/index.js';
import {SERVER} from './server.conf';
import {WebService} from '../services/web.service';
import {ViewerModel} from '../store/model/viewer.model';
import {URLSearchParams} from '@angular/http';

@Injectable()
export class ChartService {
  private _outputDataProm$: Observable<any>;
  private _inputDataProm$: Observable<any>;
  private _baseURL = SERVER.URL.BASE;
  private _maxGDPNum = 0;
  private _maxCountryXValues: Array<any> = [];
  private _outputDataURL = SERVER.URL.OUTPUT_DATA;
  private _inputInfoURL = SERVER.URL.INPUTS_INFO;
  private _inputDomains: any;
  private _inputFilterObj: any = null;
  private _inputConfig: any = {};
  private _outputDomains: any = {};
  private _globalExtentData: any = null;
  private _globalModelData: any = {};
  private _countryGroupData: any = {};
  private _policyInfoObj: any = null;
  private _newPolicyGroupedByCountryObj: any = {};
  private _newPolicyGroupedByPolicyObj: any = {};
  private _regionalPoliciesInfoObj: any = {};
  private _outputFilterObj: any = null;
  private _outputDataSubs: Subscription;
  public _outputUIList: Array<any> = [];
  public _outputList: Array<any> = [];
  private _outRelative: any = null;
  private _scoreCardDataObs$: Observable<any>;
  constructor(private webService: WebService) { }
  private _calculateRegionalAvgSinglePolicy(policy) {
    const chartConf = this.getChartsConf();
    const outputMetric = chartConf.policyMetrics;
    const outputMetricAvgInfo = {};
    const countryGr = jQuery.extend({}, this._countryGroupData);
    countryGr['GLOBAL'] = 'GLOBAL';
    jQuery.each(countryGr, (key, group) => {
      outputMetricAvgInfo[key] = {};
      outputMetric.forEach((val, idx) => {
        outputMetricAvgInfo[key][`sum_${val}`] = 0.0;
        outputMetricAvgInfo[key][`avg_${val}`] = 0.0;
        outputMetricAvgInfo[key][`count_${val}`] = 0.0;
      });
    });
    const policyList = chartConf.policyList;
    const selectedPol = policyList.map((val, idx) => {
      if (val.id === policy) {
        return idx;
      }
    }).filter(isFinite)[0];
    const policyObj = this._policyInfoObj.data[selectedPol];
    jQuery.each(countryGr, (key, group) => {
      jQuery.each(policyObj['group_name'], (k, pol) => {
        if (pol === group || key === 'GLOBAL') {
          outputMetric.forEach((val) => {
            outputMetricAvgInfo[key][`sum_${val}`] += policyObj[val][k];
            outputMetricAvgInfo[key][`count_${val}`]++;
          });
        }
      });
      outputMetric.forEach((val) => {
        outputMetricAvgInfo[group][`avg_${val}`] = outputMetricAvgInfo[group][`sum_${val}`] / outputMetricAvgInfo[group][`count_${val}`];
      });
    });
    return outputMetricAvgInfo;
  }
  private calculateAVGGDPValue(idx, groupName?, isoCode?) {
    const globalObj = this.getGlobalModelData();
    let sumGDP = 0;
    let sumPop = 0;
    let count = 0;
    let avgGDP = 0;
    let avgDoll = 0;
    let avgPop = 0;
    if (idx === 'risk' || idx === 'risk_to_assets') {
      if (isoCode) {
        avgGDP = globalObj[isoCode]['macro_gdp_pc_pp'];
        avgPop = globalObj[isoCode]['macro_pop'];
        avgDoll = Math.round(avgGDP * avgPop);
      } else {
        jQuery.each(globalObj, (key, global) => {
          sumGDP += (+global['macro_gdp_pc_pp']);
          sumPop += (+global['macro_pop']);
          count++;
        });
        avgGDP = sumGDP / count;
        avgPop = sumPop / count;
        avgDoll = Math.round(avgGDP * avgPop);
      }
    }
    return avgDoll;
  }
  private calculateGDPValues (containerId, key, numericValue, gdpDollars) {
    let percent;
    let value;
    let moreValues;
    const calculateRiskGDPValues = (percentageValue) => {
      let dollarLossGDP = (gdpDollars * (+percentageValue)) / 100;
      const aThousand = 1000;
      const aMillion = 1000000;
      let asString;
      let extraInfo;
      let aValue;
      if (dollarLossGDP >= aMillion) {
        dollarLossGDP /= aMillion;
        dollarLossGDP = Math.round(dollarLossGDP);
        asString = dollarLossGDP;
        if (dollarLossGDP >= aThousand) {
          asString = dollarLossGDP / aThousand;
          if (asString % aThousand === 0) {
            asString += '.000';
          }
          asString = asString.toString().split('.').join(',');
          asString = asString.split(',')[1].length === 2 ? asString + '0' : asString;
        }
        extraInfo = 'Million';
        aValue = `$${asString} ${extraInfo} (${percentageValue} % of GDP)`;
      } else {
        dollarLossGDP = Math.round(dollarLossGDP);
        asString = dollarLossGDP;
        if (dollarLossGDP >= aThousand) {
          asString = dollarLossGDP / aThousand;
          asString = asString.toString().split('.').join(',');
          asString = asString.split(',')[1].length === 2 ? asString + '0' : asString;
        }
        aValue = `$${asString} (${percentageValue} % of GDP)`;
      }
      return {
        dollarGDP: dollarLossGDP,
        text: aValue
      };
    };
    if (key === 'risk' || key === 'risk_to_assets') {
      moreValues = calculateRiskGDPValues(numericValue);
      value = moreValues.text;
      this._outputDomains[key]['chart'][containerId] = {
        dollarGDP: moreValues.dollarGDP,
        valueGDP: numericValue
      };
    } else {
      percent = ' %';
      value = numericValue + percent;
      this._outputDomains[key]['chart'][containerId] = numericValue;
    }
    return value;
  }
  countPolicyListCharts() {
    const svgEls = jQuery.find('div.scorecard-prioritylist svg');
    if (svgEls.length) {
      return svgEls.length;
    }
    return 0;
  }
  createInputCharts(inputData: any, containerId: string, sliderValues: any, groupName?: string) {
    jQuery(`div#${containerId}`).empty();
    const filteredInputData = this.filterInputDataByGroup(inputData, groupName);
    const inputTypeTxt = containerId.split('-')[0];
    const inputTypes = this.getInputIdChartByType(inputTypeTxt);
    const filterInputType = filteredInputData.filter(val => {
      return inputTypes.filter(type => {
        return val.key === type;
      })[0];
    });
    // Reorder input properties
    jQuery.each(filterInputType, (key, val) => {
      val.propInd = inputTypes.indexOf(val.key);
    });
    filterInputType.sort((a, b) => {
      return a.propInd - b.propInd;
    });
    jQuery.each(filterInputType, (idx, input) => {
      const dataArr = [];
      for (let k = 0; k < input.distribGroupArr.length; k++) {
        dataArr.push(input.distribGroupArr[k]['distribution']);
      }
      const data = Object.assign([], dataArr);

      const dataMean = d3.mean(data);
      sliderValues[input.key + '_display_value'] = dataMean;
      if (sliderValues[input.key]) {
        sliderValues[input.key].value = dataMean;
        sliderValues[input.key + '_value'] = dataMean / (sliderValues[input.key].max + sliderValues[input.key].min) * 100;
      }

		  // add a margin of 0.1 m,M
      if (data.length > 0) {
        const m1 = data[0] - (data[0] * 0.1);
        const m2 = data[data.length - 1] + (data[data.length - 1] * 0.1);
        data.unshift(m1);
        data.push(m2);
      } else {
        data.push(-0.1);
        data.push(0.1);
      }

      const bounds = d3.extent(data);
      const margin = {
        top: 5,
        right: 1,
        bottom: 0,
        left: 1
      };
      const width = 50 - margin.left - margin.right;
      const height = 35 - margin.top - margin.bottom;

      const kde = science.stats.kde().sample(data);
      const bw = kde.bandwidth(science.stats.bandwidth.nrd0)(data);

      const x = d3.scale.linear()
        .domain(bounds)
        .range([0, width]);

      const y = d3.scale.linear()
        .domain([0, d3.max(bw, (d) => {
          return d[1];
        })])
        .range([height, 0]);

		  // gaussian curve
      const l = d3.svg.line()
        .x((d) => {
          return x(d[0]);
        })
        .y((d) => {
          return y(d[1]);
        })
        .interpolate('basis');

		  // area under gaussian curve
      const a = d3.svg.area()
        .x((d) => {
          return x(d[0]);
        })
        .y0(height)
        .y1((d) => {
          return y(d[1]);
        });

		// bisect data array at brush selection point
      const b = d3.bisector((d) => {
        return d;
      }).left;

      const div = d3.select(`div#${containerId}`)
        .append('div')
        .attr('class', 'input-row');
        // .attr('class', 'box-tab-text');

      const table = div.append('table')
        .attr('width', '100%')
        .attr('class', 'table table-responsive')
        .attr('id', 'table-' + input.key)
        .style('pointer-events', 'none')
        .style('overflow-x', 'hidden');

      const tr = table.append('tr')
        .style('pointer-events', 'none');

        const td = tr.append('td')
        .attr('width', '50%')
        .style('padding-left', '5px')
        .style('pointer-events', 'none');

      tr.append('td')
          .attr('width', '50%')
          .style('padding', '0')
          .style('vertical-align', 'middle')
          .append('span')
            .attr('class', 'value')
            .style('pointer-events', 'none')
            .text(' ');

      const svg = td.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .attr('id', input.key)
        .attr('xmlns', 'http://www.w3.org/2000/svg')
        .style('pointer-events', 'none')
        .append('g')
          .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

		  // add gaussian curve
      const gaus = svg.append('g')
        .attr('id', input.key)
        .attr('class', 'gaussian');

      gaus.selectAll('#' + containerId + ' g#' + input.key + '.gaussian')
        // Multivariant Density Estimation
        // http://bit.ly/1Y3jEcD
        .data([science.stats.bandwidth.nrd0])
        .enter()
        .append('path')
          .attr('d', (d) => {
            return l(kde.bandwidth(d)(data));
          });

      gaus.selectAll('path')
        // .style('stroke', '#000')
        .style('stroke', '#7D8F8F')
        .style('stroke-width', '3px')
        .style('fill', 'none')
        .style('shape-rendering', 'auto');

      // add gaussian curve
      const area = svg.append('g')
        .attr('id', 'area-' + input.key)
        .attr('class', 'area');

      area.selectAll('#' + containerId + ' g#area-' + input.key + '.area')
        .data([science.stats.bandwidth.nrd0])
        .enter()
        .append('path')
          .attr('d', (d) => {
            const dd = kde.bandwidth(d)(data);
            return a(dd);
          });
      area.selectAll('path')
        // .style('fill', '#E6E8EF');
        .style('fill', '#e4e4e4');

      const mask = svg.append('g')
        .attr('id', 'mask-' + input.key)
        .attr('class', 'mask');

      // add placeholder for initial model value
      const initial = svg.append('g')
        .attr('id', 'initial-' + input.key)
        .attr('class', 'initial')
        .append('line');
      // add the brush to the input config so 
      // we can access it later
      input.forUpdate = {
        b,
        a,
        distribData: data,
        kde
      };
      input.x = x;
      input.width = width;
      input.height = height;
      if (!this._inputConfig[input.key]) {
        this._inputConfig[input.key] = {};
      }
      const inputId = containerId.indexOf('1') >= 0 ? 'input1' : 'input2';
      if (!this._inputConfig[input.key][inputId]) {
        this._inputConfig[input.key][inputId] = Object.assign({}, input);
      } else {
        this._inputConfig[input.key][inputId] = Object.assign(this._inputConfig[input.key][inputId], input);
      }

      const brush = d3.svg.brush()
        .x(x)
        .on('brushstart', brushstart)
        .on('brushend', brushend);
      const me = this;
      if (groupName === 'GLOBAL' || !groupName) {
        this._inputConfig[input.key][inputId].brush = brush;
      }
      brush.extent([0, this._inputConfig[input.key][inputId].brush.extent()[1]]);
      brush.on('brush', me._inputBrushMoveEv.call(me, containerId, input));

      const line = d3.svg.line()
        .x((d) => {
          return brush.extent()[1];
        })
        .y((d) => {
          return height;
        });

      const brushg = svg.append('g')
        .attr('class', 'brush')
        .call(brush);

      brushg.call(brush.event)
        .transition()
        .duration(750)
        .call(brush.extent([0, d3.mean(data)]))
        .call(brush.event);

      brushg.selectAll('#' + containerId + ' g.resize.w').remove();

      brushg.select('#' + containerId + ' #' + input.key + ' g.resize.e').append('path')
        .attr('d', line)
        .style('fill', '#666')
        .style('fill-opacity', '0.8')
        .style('stroke-width', '4px')
        // .style('stroke', '#7D8F8F')
        .style('stroke', '#50c4cf')
        .style('pointer-events', 'none');

      brushg.selectAll('#' + containerId + ' rect')
        .attr('height', height);

      brushg.select('rect.extent')
        .style('fill-opacity', '0')
        .style('shape-rendering', 'crispEdges');

      brushg.style('pointer-events', 'none');
      const brushEl = brushg[0][0];
      brushEl.removeAllListeners();

      const self = this;
      function brushstart() {
        svg.classed('selecting-input', true);
      }
      function brushend() {
        svg.classed('selecting-input', !d3.event.target.empty());
      }
      function _redrawInputPlot(id) {
        const config = this._inputConfig;
        const inputD = config[id];
      }
    });
  }
  createOutputChart(outputData: any, containerId: string, groupName?: string, isScoreCardPage?: boolean, isoCode?: string) {
    jQuery(`div#${containerId}`).empty();
    const finalOutput = this.filterOutputDataByGroup(outputData, groupName);
    const me = this;
    jQuery.each(finalOutput, (idx, output) => {
      const s1 = output.gradient[0];
      const s2 = output.gradient[1];
      if (!this._outputDomains[idx]['chart']) {
        this._outputDomains[idx]['chart'] = {};
      }
      if (!this._outputDomains[idx]['chart'][containerId]) {
        this._outputDomains[idx]['chart'][containerId] = '';
      }
      // sort the distribution
      const data: Array<number> = output.domain.sort((a, b) => {
        return a - b;
      });
      if (!this._globalExtentData) {
        this._globalExtentData = {};
      }
      if ((groupName === 'GLOBAL' || !groupName) && !this._globalExtentData[idx]) {
        this._globalExtentData[idx] = d3.mean(data);
      }
      const avgDoll = me.calculateAVGGDPValue(idx, groupName, isoCode);
      const bounds = d3.extent(data);
      const margin = {
        top: 5,
        right: 2,
        bottom: 0,
        left: 2
      };
      const width = (isScoreCardPage ? 140 : 110) - margin.left - margin.right;
      const height = (isScoreCardPage ? 50 : 40) - margin.top - margin.bottom;

      const kde = science['stats'].kde().sample(data);
      const bw = kde.bandwidth(science['stats'].bandwidth.nrd0)(data);
      const x = d3.scale.linear()
        .domain(bounds)
        .range([0, width])
        .clamp(true);
      const d1Y = d3.max(bw, (d) => {
        return d[1];
      });
      const y = d3.scale.linear()
        .domain([0, d1Y])
        .range([height, 0]);
      // gaussian curve
      const l = d3.svg.line()
        .x((d) => {
          return x(d[0]);
        })
        .y((d) => {
          return y(d[1]);
        });
      // area under gaussian curve
      const a = d3.svg.area()
        .x((d) => {
          return x(d[0]);
        })
        .y0(height)
        .y1((d) => {
          return y(d[1]);
        });
      // bisect data array at brush selection point
      const b = d3.bisector((d) => {
        return d;
      }).left;
      const div = d3.select(`#${containerId}`)
        .append('div')
        .attr('id', idx)
        .attr('class', 'col-sm-4')
        .attr('data-output', idx)
        .attr('data-output-title', output.descriptor)
        .style('pointer-events', 'all');

      const table = div.append('table')
        .attr('width', '100%')
        .attr('class', 'table table-responsive')
        .attr('id', 'table-' + idx);
      const tr = table.append('tr');
      const td = tr.append('td')
        .attr('width', '100%');
      const svg = td.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .attr('xmlns', 'http://www.w3.org/2000/svg')
        .attr('id', idx)
          .append('g')
            .attr('transform',
              'translate(' + margin.left + ',' + margin.top + ')')
            .style('pointer-events', 'none')
            .style('border-bottom', '1px solid lightgrey');
      // add gaussian curve
      const gaus = svg.append('g')
        .attr('id', idx)
        .attr('class', 'gaussian');
      gaus.selectAll('#' + containerId + ' g#' + idx + ' .gaussian')
      // Multivariant Density Estimation
      // http://bit.ly/1Y3jEcD
        .data([science['stats'].bandwidth.nrd0])
          .enter()
        .append('path')
        .attr('d', (d) => {
          return l(kde.bandwidth(d)(data));
        });
      // Add manually chart styles to be integrated when converting to base64 string
      gaus.selectAll('path')
        // .style('stroke', '#000')
        .style('stroke', '#7D8F8F')
        .style('stroke-width', '3px')
        .style('fill', 'none')
        .style('shape-rendering', 'auto');
      // add gaussian curve
      const area = svg.append('g')
        .attr('id', 'area-' + idx)
        .attr('class', 'area');
      area.selectAll('#' + containerId + ' g#area-' + idx + ' .area')
        .data([science['stats'].bandwidth.nrd0])
        .enter()
        .append('path')
        .attr('d', (d) => {
          return a(kde.bandwidth(d)(data));
        });
      // Add manually chart styles to be integrated when converting to base64 string
      area.selectAll('path')
        // .style('fill', '#5E6A6A');
        .style('fill', '#e4e4e4');
      // add placeholder for initial model value
      const initial = svg.append('g')
        .attr('id', 'initial-' + idx)
        .attr('class', 'initial')
        .append('line');
      // Add manually chart styles to be integrated when converting to base64 string
      svg.selectAll('g.initial line')
        .style('fill', 'none')
        // .style('stroke', '#2f4f4f')
        .style('stroke', 'transparent')
        .style('stroke-width', '2px')
        .style('opacity', '0.8');

      let infoEl;
      if (!isScoreCardPage) {
        infoEl = tr.append('td')
          .attr('width', '100%');
        infoEl.append('p')
          .attr('class', 'text-results')
          .text(output.descriptor.toUpperCase());
      } else {
        infoEl = table.append('tr');
        const tdEl = infoEl.append('td')
          .attr('width', '100%');
        const divData = tdEl.append('div')
          .attr('class', 'box-text-results text-center');
        divData.append('p')
          .attr('class', 'scorecard-title-result')
          .text(output.descriptor);
      }

      const brushstart = () => {
        svg.classed('selecting-output', true);
      };
      const brushmove = () => {
        d3.select('#' + containerId + ' #' + idx + ' g.resize.e path')
          .attr('d', 'M 0, 0 ' + ' L 0 ' + height);
      };
      const brushend = () => {
        svg.classed('selecting', !d3.event.target.empty());
      };
      const brush = d3.svg.brush()
        .x(x);
      // keep a reference to the brush for the output domain
      output.x = x;
      output.height = height;
      const outputId = containerId.indexOf('1') >= 0 ? 'output1' : 'output2';
      if (!this._outputDomains[idx][outputId]) {
        this._outputDomains[idx][outputId] = Object.assign({}, output);
      }
      if ((groupName === 'GLOBAL' || !groupName) && !this._outputDomains[idx][outputId].brush) {
        this._outputDomains[idx][outputId].brush = brush;
        if (this._globalExtentData[idx]) {
          brush.extent([0, this._globalExtentData[idx]]);
        }
      } else {
        if (this._globalExtentData[idx]) {
          brush.extent([0, this._globalExtentData[idx]]);
        }
      }
      brush.extent([0, this._outputDomains[idx][outputId].brush.extent()[1]]);
      brush.on('brush', brushmove);

      const textFn = () => {
        const precision = +output.precision;
        const brushVal = this._outputDomains[idx][outputId].brush.extent()[1];
        const numericValue = (brushVal * 100).toFixed(precision);
        const value = me.calculateGDPValues(containerId, idx, numericValue, avgDoll);
        return value;
      };

      if (!isScoreCardPage) {
        infoEl.append('p')
        .attr('class', 'text-results')
        .append('b')
        .attr('class', 'text-number')
        .text(textFn);
      } else {
        infoEl.select('div.box-text-results')
          .append('p')
          .attr('class', 'scorecard-text-result')
          .append('b')
          .attr('class', 'text-number')
          .text(textFn);
      }

      const line = d3.svg.line()
        .x((d) => {
          return d3.mean(data);
        })
        .y((d) => {
          return height;
        });

      const brushg = svg.append('g')
        .attr('class', 'brush')
        .style('pointer-events', 'none')
        .call(brush);

      brushg.call(brush.event)
        .transition()
        .duration(750)
        .call(brush.extent([0, d3.mean(data)]))
        .call(brush.event);

      brushg.selectAll('#' + containerId + ' g.resize.w').remove();
      // Add manually chart styles to be integrated when converting to base64 string
      brushg.select('#' + containerId + ' #' + idx + ' g.resize.e').append('path')
        .attr('d', line)
        .style('fill', '#666')
        .style('fill-opacity', '0.8')
        .style('stroke-width', '4px')
        // .style('stroke', '#C3D700')
        .style('stroke', '#50c4cf')
        .style('pointer-events', 'none');
      // Add manually chart styles to be integrated when converting to base64 string
      brushg.select('rect.extent')
        .style('fill-opacity', '0')
        .style('shape-rendering', 'crispEdges');

      brushg.selectAll('#' + containerId + ' rect')
        .attr('height', height)
        .style('pointer-events', 'none');
    });
  }
  createPolicyListChart(policyListData: any, containerId: string, countryList: any) {
    let dkTotArr = [];
    let dWTotCurrencyArr = [];
    const dKTotPercentageArr = [];
    const dWTotPercentageArr = [];
    let allData = [];
    const isPolicyListObject = typeof countryList === 'object' && countryList['type'] === 'policyList';
    const isCountryListObject = typeof countryList === 'object' && countryList['type'] === 'policyMeasure';
    const isCountryListCurrencyBased = isCountryListObject && countryList['chartType'] === 'absolute';
    const isCountryListPercentageBased = isCountryListObject && countryList['chartType'] === 'relative';

    jQuery.each(policyListData, (idx, polData) => {
      const dKtot = countryList['chartType'] === 'absolute' ? +polData['num_asset_losses_label'] : +polData['rel_num_asset_losses_label'];
      const dWtot_currency = countryList['chartType'] === 'absolute' ?
        +polData['num_wellbeing_losses_label'] : +polData['rel_num_wellbeing_losses_label'];
      const dKtotLabel = countryList['chartType'] === 'absolute' ?
        polData['asset_losses_label'] : polData['rel_asset_losses_label'];
      const dWtot_currencyLabel = countryList['chartType'] === 'absolute' ?
        polData['wellbeing_losses_label'] : polData['rel_wellbeing_losses_label'];
      dkTotArr.push(dKtot);
      dWTotCurrencyArr.push(dWtot_currency);
      allData.push({
        id: idx,
        dKtot,
        dWtot_currency,
        dKtotLabel,
        dWtot_currencyLabel
      });
    });
    const aMillion = 1000000;
    let policyList;
    const globalObj = this.getGlobalModelData();
    if (isCountryListObject) {
      const regionSelected = countryList['region'];
      const allDataLength = allData.length;
      const allDataFiltered = [];
      const MAX_COUNTRIES_POLICY_MEASURE = 15;
      if (regionSelected !== 'GLOBAL') {
        jQuery.each(globalObj, (key, global) => {
          const countryName = global.name;
          const countryRegion = global['group_name'];
          if (countryRegion === regionSelected) {
            for (let i = 0; i < allDataLength; i += 1) {
              if (allData[i].id === countryName) {
                allDataFiltered.push(allData[i]);
                break;
              }
            }
          }
        });
        allData = Object.assign([], allDataFiltered);
      }
      let tempAllData = Object.assign([], allData);
      const tempDataLength = tempAllData.length;
      tempAllData.sort((a, b) => {
        return (+b.dWtot_currency) - (+a.dWtot_currency);
      });
      tempAllData = tempAllData.slice(0, MAX_COUNTRIES_POLICY_MEASURE);
      allData = tempAllData.filter(temp => {
        return allData.filter(val => {
          return val.id === temp.id;
        })[0];
      });
      // console.log(allData);
    } else {
      const policyData = dkTotArr.concat(dWTotCurrencyArr);
      const maxCountryVal = d3.max(policyData);
      const MAX_SELECTED_COUNTRIES = 2;
      if (this._maxCountryXValues.length < MAX_SELECTED_COUNTRIES) {
        const filterContainer = this._maxCountryXValues.filter(val => val.chart === containerId);
        if (!filterContainer.length) {
          this._maxCountryXValues.push({
            chart: containerId,
            type: countryList['chartType'],
            maxVal: maxCountryVal
          });
        } else {
          this._maxCountryXValues.forEach(val => {
            if (val.chart === containerId) {
              if (val.type !== countryList['chartType']) {
                this._maxGDPNum = 0;
              }
              val.type = countryList['chartType'];
              val.maxVal = maxCountryVal;
            }
          });
        }
      } else {
        const filterChartType = this._maxCountryXValues.filter(val => val.type === countryList['chartType']);
        if (!filterChartType.length && this.countPolicyListCharts() === 2) {
          this._maxGDPNum = 0;
          this._maxCountryXValues.forEach(val => {val.type = countryList['chartType']; val.maxVal = 0; });
        } else {
          this._maxGDPNum = d3.max(this._maxCountryXValues, d => d.maxVal);
        }
        this._maxCountryXValues.forEach(val => {
          if (val.chart === containerId) {
            val.maxVal = maxCountryVal;
          }
        });
      }
      const maxVal = d3.max(this._maxCountryXValues, (d) => {
        return d.maxVal;
      });
      if (maxVal > this._maxGDPNum) {
        this._maxGDPNum = maxVal;
      }
      policyList = this.getChartsConf().policyList;
      policyList.forEach((val, idx) => {
        if (val.id === allData[idx].id) {
          allData[idx].label = val.label;
        }
      });
    }
    const allDataClone = Object.assign([], allData);
    const isNewChart = countryList.hasOwnProperty('isNew') && countryList['isNew'];

    const recalculateChartHeight = () => {
      const region = countryList['region'];
      if (region === 'East Asia & Pacific') {
        return 1300;
      } else if (region === 'South Asia') {
        return 500;
      } else if (region === 'North America') {
        return 220;
      } else if (region === 'Middle East & North Africa') {
        return 880;
      }
      return 1400;
    };
    const maxValue = isPolicyListObject ? this._maxGDPNum : d3.max(allData, (d) => {
      return d.dWtot_currency;
    });
    let w;
    if (isCountryListObject) {
      w = 690;
    } else if (isPolicyListObject) {
      w = 800;
    } else {
      w = 700;
    }
    const h = isCountryListObject ? recalculateChartHeight() : 1000;
    const margin = {
      left: isPolicyListObject ? 170 : 130,
      right: 60,
      bottom: 50,
      top: 5
    };
    const width = w - margin.left - margin.right;
    const height = h - margin.top - margin.bottom;
    const spaceLblCh = 10;
    let xDomain = [];
    xDomain.push(-1, maxValue);

    const xLane = d3.scale.linear()
      .domain(xDomain).nice()
      .range([0, width - margin.left - spaceLblCh - margin.right]);
    let yDomainList = allData.map(val => isCountryListObject ? val.id : val.label);
    const yLane = d3.scale.ordinal()
      .domain(yDomainList)
      .rangeBands([0, height]);

    const xAxis = d3.svg.axis()
      .scale(xLane)
      .orient('bottom');
    const yAxis = d3.svg.axis()
      .scale(yLane)
      .orient('left');
    const yRightAx = d3.svg.axis()
      .scale(yLane)
      .orient('right');

    const xGridLines = d3.svg.axis()
      .scale(xLane)
      .tickSize(-height, 0, 0)
      .tickFormat('')
      .orient('bottom');
    // Add SVG element
    let laneChart;
    if (isNewChart) {
      laneChart = d3.select(`#${containerId}`)
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    } else {
      laneChart = d3.select(`#${containerId} svg`);
      if (height !== laneChart.attr('height')) {
        laneChart.attr('height', height);
      }
    }

    // Label wrap text function
    const textWrap = (text, txtWidth) => {
      text.each(function() {
        const textEl = d3.select(this),
            words = textEl.text().split(/\s+/).reverse();
        let word,
            line = [],
            lineNumber = 0;
        const lineHeight = 1.1, // ems
            y = textEl.attr('y'),
            dy = parseFloat(textEl.attr('dy'));
        let tspan = textEl.text(null).append('tspan').attr('x', 0).attr('y', y).attr('dy', dy + 'em');
        while (word = words.pop()) {
          line.push(word);
          tspan.text(line.join(' '));
          if (tspan.node().getComputedTextLength() > txtWidth) {
            line.pop();
            tspan.text(line.join(' '));
            line = [word];
            tspan = textEl.append('tspan').attr('x', 0).attr('y', y).attr('dy', (++lineNumber * lineHeight + dy) + 'em').text(word + ' ');
          }
        }
      });
    };
    // Sort data
    if (countryList.hasOwnProperty('barType') && countryList.hasOwnProperty('sort')) {
      if (countryList['barType'] === '1' && countryList['sort'] === 'Ascending') {
        allData.sort((a, b) => {
          return a.dWtot_currency - b.dWtot_currency;
        });
      } else if (countryList['barType'] === '2' && countryList['sort'] === 'Ascending') {
        allData.sort((a, b) => {
          return a.dKtot - b.dKtot;
        });
      }
      if (countryList['barType'] === '1' && countryList['sort'] === 'Descending') {
        allData.sort((a, b) => {
          return b.dWtot_currency - a.dWtot_currency;
        });
      } else if (countryList['barType'] === '2' && countryList['sort'] === 'Descending') {
        allData.sort((a, b) => {
          return b.dKtot - a.dKtot;
        });
      }
      if ((countryList['barType'] === '1' || countryList['barType'] === '2') && countryList['sort'] === 'NORMAL') {
        allData = allDataClone;
      }
    }

    const plotChartAxes = (params) => {
      const yLabelPos = isCountryListObject ? -25 : -35;
      const xDescLabel = countryList['chartType'] === 'relative' ?
        'Percent % of Country GDP' : 'US$, millions per year';
      const xLabelPosition = width / 3.5;
      if (isNewChart) {
        // Adding lane lines
        laneChart.append('g')
          .call(params.gridLines.x)
          .classed('lanes', true)
          .attr('transform', 'translate(' + (margin.left + spaceLblCh) + ',' + (height - margin.bottom) + ')');
        // Adding X axis
        laneChart.append('g')
          .classed('x-axis', true)
          .attr('transform', 'translate(' + (margin.left + spaceLblCh) + ', ' + (height - margin.bottom) + ')')
          .call(params.axis.x);
        // Adding x axis descriptive label
        laneChart.select('.x-axis')
          .append('text')
          .classed('x-axis-lb', true)
          .attr('x', 0)
          .attr('y', 0)
          .style('text-anchor', 'middle')
          .attr('transform', 'translate(' + xLabelPosition + ', ' + (margin.bottom - spaceLblCh) + ')')
          .text(xDescLabel);
        // Adding y axis labels
        laneChart.append('g')
          .classed('y-axis', true)
          .attr('transform', 'translate(' + margin.left + ', ' + yLabelPos + ')')
          .call(params.axis.y);
        laneChart.select('.y-axis')
          .selectAll('.tick text')
          .call(textWrap, margin.left);
      } else {
        // Update lane lines
        laneChart.selectAll('g.lanes')
          .attr('transform', 'translate(' + (margin.left + spaceLblCh) + ',' + (height - margin.bottom) + ')')
          .call(params.gridLines.x);
        // Update x-axis labels
        laneChart.selectAll('g.x-axis')
          .attr('transform', 'translate(' + (margin.left + spaceLblCh) + ', ' + (height - margin.bottom) + ')')
          .call(params.axis.x);
        // Update y-axis labels
        laneChart.selectAll('g.y-axis')
          .attr('transform', 'translate(' + margin.left + ', ' + yLabelPos + ')')
          .call(params.axis.y);
        laneChart.select('.y-axis')
          .selectAll('.tick text')
          .call(textWrap, margin.left);
        // Update x-axis descriptive label style
        laneChart.select('.x-axis-lb')
          .style('text-anchor', 'middle')
          .attr('transform', 'translate(' + xLabelPosition + ', ' + (margin.bottom - spaceLblCh) + ')')
          .text(xDescLabel);
      }
    };

    const plotChart = (params) => {
      // Update domains
      // X domain
      const minFirstBarValue = d3.min(params.data, (d) => {
        return d.dWtot_currency;
      });
      const minSecondBarValue = d3.min(params.data, (d) => {
        return d.dKtot;
      });
      const minValues = [minFirstBarValue, minSecondBarValue];
      const min = d3.min(minValues);
      if (min < -1) {
        xDomain = [min, maxValue];
        xLane.domain(xDomain).nice();
      }
      // Y Domain
      yDomainList = params.data.map(val => isCountryListObject ? val.id : val.label);
      yLane.domain(yDomainList);
      // Draw axes
      plotChartAxes(params);
      // Draw bar charts
      let eBar;
      let dataBars;
      let barLabels;
      if (isNewChart) {
        // Add empty bar charts container
        eBar = laneChart.append('g')
          .classed('e-bar', true);
        // Add bars with data container
        dataBars  = laneChart.append('g')
          .classed('bar-charts', true);
         // Add right y-position bar labels container
        barLabels = laneChart.append('g')
          .classed('bar-labels', true);
      } else {
        eBar = laneChart.select('.e-bar');
        dataBars = laneChart.select('.bar-charts');
        barLabels = laneChart.select('.bar-labels');
      }
      const barHeight = 15;
      const spaceBars = 5;
      // Exit phase
      eBar
        .selectAll('.empty-bar1')
        .data(params.data)
        .exit()
        .remove();
      eBar
        .selectAll('.empty-bar2')
        .data(params.data)
        .exit()
        .remove();
      dataBars
        .selectAll('.bar-chart1')
        .data(params.data)
        .exit()
        .remove();
      dataBars
        .selectAll('.bar-chart2')
        .data(params.data)
        .exit()
        .remove();
      barLabels
        .selectAll('.labels1')
        .data(params.data)
        .exit()
        .remove();
      barLabels
        .selectAll('.labels2')
        .data(params.data)
        .exit()
        .remove();
      // Enter phase
      eBar
        .selectAll('.empty-bar1')
        .data(params.data)
        .enter()
          .append('rect')
          .classed('empty-bar1', true);
      eBar
        .selectAll('.empty-bar2')
        .data(params.data)
        .enter()
          .append('rect')
          .classed('empty-bar2', true);
      dataBars.selectAll('.bar-chart1')
        .data(params.data)
        .enter()
          .append('rect')
          .classed('bar-chart1', true);
      dataBars.selectAll('.bar-chart2')
        .data(params.data)
        .enter()
          .append('rect')
          .classed('bar-chart2', true);
      barLabels.selectAll('.labels1')
        .data(params.data)
        .enter()
          .append('text')
          .classed('labels1', true);
      barLabels.selectAll('.labels2')
        .data(params.data)
        .enter()
          .append('text')
          .classed('labels2', true);
      // Update phase
      const formatNumericData = (data) => {
        let value: any = Math.abs(Math.round(data));
        const aThousand = 1000;
        if (value >= aThousand) {
          if (value % aThousand !== 0) {
            value = (value / aThousand).toString().replace('.', ',');
          } else {
            value = (value / aThousand).toString() + ',000';
          }
        }
        return value;
      };
      eBar
        .selectAll('.empty-bar1')
        .transition()
        .duration(500)
        .ease('bounce')
        .attr('x', (d, i) => {
          return 0;
        })
        .attr('y', (d, i) => {
          const yParam = isCountryListObject ? d.id : d.label;
          return yLane(yParam);
        })
        .attr('rx', 10)
        .attr('ry', 30)
        .attr('width', (d) => {
          return width - margin.left - spaceLblCh - margin.right;
        })
        .attr('height', (d, i) => {
          return barHeight;
        })
        .attr('transform', 'translate(' + (margin.left + spaceLblCh) + ', 0)')
        .style('fill', '#485050');
      eBar
        .selectAll('.empty-bar2')
        .transition()
        .duration(500)
        .ease('bounce')
        .attr('x', (d, i) => {
          return 0;
        })
        .attr('y', (d, i) => {
          const yParam = isCountryListObject ? d.id : d.label;
          return yLane(yParam) + barHeight + spaceBars;
        })
        .attr('rx', 10)
        .attr('ry', 30)
        .attr('width', (d) => {
          return width - margin.left - spaceLblCh - margin.right;
        })
        .attr('height', (d, i) => {
          return barHeight;
        })
        .attr('transform', 'translate(' + (margin.left + spaceLblCh) + ', 0)')
        .style('fill', '#485050');
      dataBars
        .selectAll('.bar-chart1')
        .transition()
        .duration(500)
        .ease('bounce')
        .attr('x', (d, i) => {
          const data = d.dWtot_currency;
          let from = data;
          if (data >= 0) {
            from = 0;
          }
          return xLane(Math.min(0, data));
        })
        .attr('y', (d, i) => {
          const yParam = isCountryListObject ? d.id : d.label;
          return yLane(yParam);
        })
        .attr('rx', 10)
        .attr('ry', 30)
        .attr('width', (d) => {
          const data = d.dWtot_currency;
          const total = xLane(data);
          let fromZero = 0;
          if (data >= 0) {
            fromZero = xLane(0);
          }
          return Math.abs(total - xLane(0));
        })
        .attr('height', (d, i) => {
          return barHeight;
        })
        .attr('transform', 'translate(' + (margin.left + spaceLblCh) + ', 0)')
        .style('fill', '#6DCCDC');
      dataBars
        .selectAll('.bar-chart2')
        .transition()
        .duration(500)
        .ease('bounce')
        .attr('x', (d, i) => {
          const data = d.dKtot;
          let from = data;
          if (data >= 0) {
            from = 0;
          }
          return xLane(Math.min(0, data));
        })
        .attr('y', (d, i) => {
          const yParam = isCountryListObject ? d.id : d.label;
          return yLane(yParam) + barHeight + spaceBars;
        })
        .attr('rx', 10)
        .attr('ry', 30)
        .attr('width', (d) => {
          const data = d.dKtot;
          const total = xLane(data);
          let fromZero = data;
          if (data >= 0) {
            fromZero = xLane(0);
          }
          return Math.abs(total - xLane(0));
        })
        .attr('height', (d, i) => {
          return barHeight;
        })
        .attr('transform', 'translate(' + (margin.left + spaceLblCh) + ', 0)')
        .style('fill', '#C3D700');
      barLabels
        .selectAll('.labels1')
        .transition()
        .duration(500)
        .ease('bounce')
        .attr('x', (d, i) => {
          return width - 50;
        })
        .attr('y', (d, i) => {
          const yParam = isCountryListObject ? d.id : d.label;
          return yLane(yParam) + barHeight - spaceBars;
        })
        .style('fill', '#6DCCDC')
        .text((d) => {
          let data;
            if (countryList['chartType'] === 'absolute') {
              data = (d.dWtot_currency < 0 ?
                '-$' + formatNumericData(d.dWtot_currency) : '$' + formatNumericData(d.dWtot_currency));
            } else {
              data = (d.dWtot_currency).toFixed(1) + '%';
            }
          // }
          return data;
        });
      barLabels
        .selectAll('.labels2')
        .transition()
        .duration(500)
        .ease('bounce')
        .attr('x', (d, i) => {
          return width - 50;
        })
        .attr('y', (d, i) => {
          const yParam = isCountryListObject ? d.id : d.label;
          return yLane(yParam) + (barHeight * 2) + spaceBars;
        })
        .style('fill', '#C3D700')
        .text((d) => {
          let data;
          if (countryList['chartType'] === 'absolute') {
            data = (d.dKtot < 0 ? '-$' + formatNumericData(d.dKtot) : '$' + formatNumericData(d.dKtot));
          } else {
            data = (d.dKtot).toFixed(1) + '%';
          }
          return data;
        });
    };
    plotChart({
      data: allData,
      axis: {
        x: xAxis,
        y: yAxis
      },
      gridLines: {
          x: xGridLines
      }
    });
  }
  filterOutputDataByGroup(outputData, groupName: string) {
    if (groupName === 'GLOBAL' || !groupName) {
      return outputData;
    }
    this._outputFilterObj = this._outputFilterObj || jQuery.extend(true, {}, outputData);
    const filteredOutputDomains = this._outputFilterObj;
    for (const key in outputData as any) {
      if (outputData.hasOwnProperty(key)) {
        for (const key2 in outputData[key] as any) {
          if (outputData[key].hasOwnProperty(key2) && (key2 === 'domain' || key2 === 'group_name')) {
            filteredOutputDomains[key][key2] = [];
          }
        }
        for (let i = 0; i < outputData[key]['group_name'].length; i++) {
          if (groupName === outputData[key]['group_name'][i]) {
            filteredOutputDomains[key]['domain'].push(outputData[key]['domain'][i]);
            filteredOutputDomains[key]['group_name'].push(outputData[key]['group_name'][i]);
          }
        }
      }
    }
    return filteredOutputDomains;
  }
  filterInputDataByGroup(inputData, groupName?: string) {
    if (groupName === 'GLOBAL' || !groupName) {
      return inputData;
    }
    this._inputFilterObj = this._inputFilterObj || jQuery.extend(true, [], inputData);
    const filteredInputDomains = this._inputFilterObj;

    for (const g in filteredInputDomains) {
      if (filteredInputDomains.hasOwnProperty(g)) {
        if (filteredInputDomains[g]) {
          filteredInputDomains[g]['distribGroupArr'] = [];
        }
      }
    }
    for (const g in inputData) {
      if (inputData.hasOwnProperty(g)) {
        if (inputData[g]) {
          for (let m = 0; m < inputData[g]['distribGroupArr'].length; m++) {
            if (inputData[g]['distribGroupArr'][m]['group'] === groupName) {
              filteredInputDomains[g]['distribGroupArr'].push(inputData[g]['distribGroupArr'][m]);
            }
          }
        }
      }
    }
    return filteredInputDomains;
  }
  private changeRelativeValue(str){
    this._outRelative = [];
    const res = str.substring(str.indexOf('(') + 1, str.indexOf(')'));
    const foo = ' (' + str.substring(0, str.indexOf('(') - 1) + ')';
    this._outRelative[0] = res + foo;
    const percent = str.substring(str.indexOf('(') + 1, str.indexOf(')') - 1);
    this._outRelative[1] = percent;
    return this._outRelative;
  }
  formatInputChartValues(data, input, persistedBrush?) {
    let percent = input.number_type === ('percent' || 'small_percent') ? '%' : '';
    let value: any = data.toFixed(1);
    percent = input.key === 'macro_T_rebuild_K' ? ' Yrs' : percent;
    percent = input.key.indexOf('hazard') >= 0 ? '%' : percent;
    if (input.key === 'k_cat_info__poor' || input.key === 'k_cat_info__nonpoor') {
      const aThousand = 1000;
      value = Math.round(+value);
      if (value >= aThousand) {
        if (value % aThousand === 0) {
          value /= aThousand;
          value = value + '.000';
        } else {
          value /= aThousand;
        }
        value = '$' + value.toString().replace('.', ',');
        value = value.split(',')[1].length === 2 ? value + '0' : value;
      }
    } else if (percent !== '') {
      data = input.key === 'macro_T_rebuild_K' ? data : (persistedBrush ? (+persistedBrush.extent()[1]) * 100 : data * 100);
      value = data.toFixed(1) + percent;
    }
    return value;
  }
  formatSVGChartBase64Strings(chartId, isFromOutputChart, inChartId?) {
    const id1 = isFromOutputChart ? 'outputs-1' : `${chartId}-1`;
    const id2 = isFromOutputChart ? 'outputs-2' : `${chartId}-2`;
    const chartCtn1 = jQuery(`#${id1}`);
    const chartCtn2 = jQuery(`#${id2}`);
    const chart1 = chartCtn1.find('svg');
    const chart2 = chartCtn2.find('svg');
    const filterFn = (idx, svg) => {
      const id = isFromOutputChart ? chartId : inChartId;
      return svg.id === id;
    };
    const ch1 = chart1.filter(filterFn)[0];
    const ch2 = chart2.filter(filterFn)[0];
    const svgPrefixStr = "data:image/svg+xml;base64,";
    const ch1XMLStr = new XMLSerializer().serializeToString(ch1);
    const ch1Fmt = window.btoa(ch1XMLStr);
    const ch1Str = svgPrefixStr + ch1Fmt;
    const ch2XMLStr = new XMLSerializer().serializeToString(ch2);
    const ch2Fmt = window.btoa(ch2XMLStr);
    const ch2Str = svgPrefixStr + ch2Fmt;
    return {
      chart1: <string> ch1Str,
      chart2: <string> ch2Str
    };
  }
  getGlobalModelData() {
    return this._globalModelData;
  }
  getChartsConf() {
    return {
      'outputs': {
        'risk_to_assets': {
          'descriptor': 'Risk to assets',
          'gradient': ['#f0f9e8', '#08589e'],
          'number_type': 'percent',
          'precision': 2
        },
        'resilience': {
          'descriptor': 'Socio-economic capacity',
          'gradient': ['#990000', '#fef0d9'],
          'number_type': 'percent',
          'precision': 2
        },
        'risk': {
          'descriptor': 'Risk to well-being',
          'gradient': ['#edf8fb', '#6e016b'],
          'number_type': 'percent',
          'precision': 2
        }
      },
      'inputs': ['gamma_SP_cat_info__poor', 'macro_tau_tax', 'macro_borrow_abi', 'macro_prepare_scaleup',
        'macro_T_rebuild_K', 'shew_for_hazard_ratio', 'axfin_cat_info__poor', 'axfin_cat_info__nonpoor',
        'k_cat_info__poor', 'k_cat_info__nonpoor', 'hazard_ratio_flood_poor', 'hazard_ratio_fa__flood',
        'v_cat_info__poor', 'v_cat_info__nonpoor', 'hazard_ratio_fa__earthquake', 'hazard_ratio_fa__tsunami', 'hazard_ratio_fa__wind'
      ],
      'inputTypes' : {
        'inputSoc': ['gamma_SP_cat_info__poor', 'macro_tau_tax', 'macro_borrow_abi', 'macro_prepare_scaleup', 'macro_T_rebuild_K'],
        'inputEco': ['axfin_cat_info__poor', 'axfin_cat_info__nonpoor', 'k_cat_info__poor', 'k_cat_info__nonpoor'],
        'inputVul': ['v_cat_info__poor', 'v_cat_info__nonpoor', 'shew_for_hazard_ratio'],
        'inputExp': ['hazard_ratio_flood_poor', 'hazard_ratio_fa__flood', 'hazard_ratio_fa__earthquake', 'hazard_ratio_fa__tsunami',
          'hazard_ratio_fa__wind']
      },
      'policyList': [
        {'id': 'axfin', 'label': 'Universal access to finance', 'mapping': 'axfin'},
        {'id': 'fap', 'label': 'Reduce exposure of the poor by 5% of total exposure', 'mapping': 'v_cat_info__poor'},
        {'id': 'far', 'label': 'Reduce exposure of the nonpoor by 5% of total exposure', 'mapping': 'v_cat_info__nonpoor'},
        {'id': 'kp', 'label': 'Increase income of the poor 10%', 'mapping': 'k_cat_info__poor'},
        {'id': 'pdspackage', 'label': 'Postdisaster support package', 'mapping': 'optionPDS'},
        {'id': 'prop_nonpoor', 'label': 'Develop market insurance (nonpoor people)', 'mapping': 'optionFee'},
        {'id': 'shew', 'label': 'Universal access to early warnings', 'mapping': 'shew_for_hazard_ratio'},
        {'id': 'social_p', 'label': 'Increase social transfers to poor people to at least 33%', 'mapping': 'gamma_SP_cat_info__poor'},
        {'id': 't_rebuild_k', 'label': 'Accelerate reconstruction (by 33%)', 'mapping': 'macro_T_rebuild_K'},
        {'id': 'vp', 'label': 'Reduce asset vulnerability (by 30%) of poor people (5% population)', 'mapping': 'v_cat_info__poor'},
        {'id': 'vr',
          'label': 'Reduce asset vulnerability (by 30%) of nonpoor people (5% population)', 'mapping': 'v_cat_info__nonpoor'}
      ],
      'policyMetrics': ['dK', 'dKtot', 'dWpc_currency', 'dWtot_currency'],
      'inputs_info': 'inputs_info_wrapper.csv',
      'default_input': 'axfin_p',
      'default_output': 'resilience',
      'default_feature': 'AUS',
      'model_data': 'df_for_wrapper.csv',
      'model_scp_data': 'df_for_wrapper_scp.csv',
      'model_function': 'res_ind_lib.compute_resilience_from_packed_inputs',
      'policy_model_fn': 'res_ind_lib_big.compute_resilience_from_adjusted_inputs_for_pol',
      'pop': 'pop',
      'gdp': 'gdp_pc_pp',
      'map': {
        'width': 500,
        'height': 350
      }
    };
  }
  getCountryGroupData() {
    return this._countryGroupData;
  }
  getInputDataObj() {
    return this._inputConfig;
  }
  getInputData() {
    return this._inputDomains;
  }
  getInputDataObs() {
    return this._inputDataProm$;
  }
  getInputIdChartByType(type: string) {
    const inputTypes = this.getChartsConf().inputTypes;
    return inputTypes[type];
  }
  getInputPModelData(data: ViewerModel): Observable<Response> {
    const url = SERVER.URL.BASE_SERVER_PY + SERVER.URL.SERVER_INPUT_PY;
    const chartConf = this.getChartsConf();
    const model = chartConf.model_function;
    const modelData = chartConf.model_data;
    const formData = new URLSearchParams();
    formData.append('d', JSON.stringify(data));
    formData.append('g', '');
    formData.append('m', model);
    formData.append('i_df', modelData);
    return this.webService.post(url, formData).map((res: Response) => res.json()).catch(this.webService.errorHandler);
  }
  getMaxGDPCountryValue() {
    return this._maxGDPNum;
  }
  getMaxGDPCountryValues() {
    return this._maxCountryXValues;
  }
  getMetricAllCountriesSinglePolicy(policy) {
    const allCountriesPolicy = this._newPolicyGroupedByPolicyObj;
    return allCountriesPolicy[policy];
  }
  getMetricAllPoliciesSingleCountry(countryName: string) {
    const allPoliciesCountry = this._newPolicyGroupedByCountryObj;
    return allPoliciesCountry[countryName];
  }
  getOutputData() {
    return this._outputDomains;
  }
  getOutputDataObs() {
    return this._outputDataProm$;
  }
  getOutputDataUIList() {
    return this._outputUIList;
  }
  getOutputList() {
    return this._outputList;
  }
  getPolicyListData() {
    return this._policyInfoObj;
  }
  getRegionalPolicyData() {
    return this._regionalPoliciesInfoObj;
  }
  getScorecardData() {
    const url = SERVER.URL.BASE;
    const axfinUrl = url + SERVER.URL.AXFIN_DATA;
    const fapUrl = url + SERVER.URL.FAP_DATA;
    const farUrl = url + SERVER.URL.FAR_DATA;
    const kpUrl = url + SERVER.URL.KP_DATA;
    const pdsUrl = url + SERVER.URL.PDS_DATA;
    const propUrl = url + SERVER.URL.PROP_DATA;
    const shewUrl = url + SERVER.URL.SHEW_DATA;
    const socialUrl = url + SERVER.URL.SOCIAL_DATA;
    const tkUrl = url + SERVER.URL.TK_DATA;
    const vpUrl = url + SERVER.URL.VP_DATA;
    const vrUrl = url + SERVER.URL.VR_DATA;
    const chartConf = this.getChartsConf();
    const policyList = chartConf.policyList;
    const promisedData = new Promise((resolve, reject) => {
      d3Q.queue()
        .defer(d3.csv, axfinUrl)
        .defer(d3.csv, fapUrl)
        .defer(d3.csv, farUrl)
        .defer(d3.csv, kpUrl)
        .defer(d3.csv, pdsUrl)
        .defer(d3.csv, propUrl)
        .defer(d3.csv, shewUrl)
        .defer(d3.csv, socialUrl)
        .defer(d3.csv, tkUrl)
        .defer(d3.csv, vpUrl)
        .defer(d3.csv, vrUrl)
        .await((err, axfin, fap, far, kp, pdsPackage, propNonpoor, shew, socialP, tRebuildK, vp, vr) => {
          if (err) { reject(err); }
          const data = [axfin, fap, far, kp, pdsPackage, propNonpoor, shew, socialP, tRebuildK, vp, vr];
          resolve(data);
        });
    });
    this._scoreCardDataObs$ = Observable.fromPromise(promisedData);
  }
  getScoreCardDataObs() {
    return this._scoreCardDataObs$;
  }
  initOutputChartConf() {
    this.setOutputData();
  }
  initScorecardChartConf() {
    this.getScorecardData();
  }
  _inputBrushMoveEv(containerId, input) {
    const me = this;
    return () => {
      const inputId = containerId.indexOf('1') >= 0 ? 'input1' : 'input2';
      const toUpd =  me._inputConfig[input.key][inputId].forUpdate;
      jQuery('#' + containerId + ' svg#' + input.key + ' #mask-' + input.key).empty();
      const s = me._inputConfig[input.key][inputId].brush.extent();
      const clip = toUpd.b(toUpd.distribData, s[1]);
      const selected = toUpd.distribData.slice(0, clip);
      selected.push(s[1]);
      const mask = d3.select(`#${containerId} svg#${input.key} #mask-${input.key}`);
      mask.selectAll('#' + containerId + ' g#mask-' + input.key + '.mask')
        .data([science.stats.bandwidth.nrd0])
        .enter()
          .append('path')
          // .style('fill', '#50C4CF')
          .style('fill', '#e4e4e4')
          .style('opacity', '1')
          .attr('d', (d) => {
            return toUpd.a(toUpd.kde.bandwidth(d)(selected));
          });
      d3.select('#' + containerId + ' #' + input.key + ' g.resize.e path')
        .attr('d', 'M 0, 0 ' + ' L 0 ' + input.height);
      const span = jQuery('#' + containerId + ' #table-' + input.key + ' span.value');
      span.empty();
      span.html(() => {
        const persistedBrush = me._inputConfig[input.key][inputId].brush;
        const ext = +persistedBrush.extent()[1];
        const value = me.formatInputChartValues(ext, input, persistedBrush);
        return value;
      });
    };
  }
  private _populateInputDomains(inputArr, _globalModelData) {
    const inputIds = this.getChartsConf().inputs;
    const inputDomains = [];
    // this._globalModelData = _globalModelData;
    inputArr.forEach((val, index, arr) => {
      if (inputIds.indexOf(val.key) >= 0) {
        const inpObj: any = {};
        inpObj.key = val.key;
        inpObj.descriptor = val.descriptor;
        inpObj.distribGroupArr = [];
        inpObj.lower = +val.lower;
        inpObj.upper = +val.upper;
        inpObj.number_type = val.number_type;
        jQuery.each(_globalModelData, (ind, globalObj) => {
          if (!isNaN(globalObj[val.key])) {
            const value = +globalObj[val.key];
            const obj: any = {};
            if (inpObj.lower === 0 && inpObj.upper === 0) {
              obj.distribution = value;
              obj.group = globalObj['group_name'];
              inpObj.distribGroupArr.push(obj);
            } else if (value > inpObj.upper) {
              globalObj[val.key] = inpObj.upper;
              obj.distribution = inpObj.upper;
              obj.group = globalObj['group_name'];
              inpObj.distribGroupArr.push(obj);
            } else {
              obj.distribution = value;
              obj.group = globalObj['group_name'];
              inpObj.distribGroupArr.push(obj);
            }
            // obj.group = globalObj['group_name'];
            // inpObj.distribGroupArr.push(obj);
          }
        });
        this._sortByKey(inpObj.distribGroupArr, 'distribution');
        inputDomains.push(inpObj);
      }
    });
    return inputDomains;
  }
  setInputData(_globalModelData: any) {
    const url = `${this._baseURL}${this._inputInfoURL}`;
    const promisedData = new Promise((resolve, reject) => {
      d3.csv(url, (err, data: any) => {
        if (err) { reject(err); }
        const inputDomainsArr = [];
        data.forEach((value) => {
          const inputObj = {};
          inputObj['key'] = value.key;
          inputObj['descriptor'] = value.descriptor;
          inputObj['lower'] = +value.lower;
          inputObj['upper'] = +value.upper;
          inputObj['number_type'] = value.number_type;
          inputDomainsArr.push(inputObj);
        });
        this._inputDomains = this._populateInputDomains(inputDomainsArr, _globalModelData);
        resolve(this._inputDomains);
      });
    });
    return promisedData;
    // this._inputDataProm$ = Observable.fromPromise(promisedData);
  }
  setOutputData() {
    const outputConf = this.getChartsConf().outputs;
    Object.keys(outputConf).forEach(key => {
      this._outputDomains[key] = outputConf[key];
      this._outputDomains[key]['domain'] = [];
      this._outputDomains[key]['group_name'] = [];
    });
    const url = `${this._baseURL}${this._outputDataURL}`;
    this._outputUIList = [];
    const promisedData = new Promise((resolve, reject) => {
      d3.csv(url, (err, data: any) => {
        if (err) { reject(err); }
        data.forEach((value, index, arr) => {
          for (const key in value) {
            if (value.hasOwnProperty(key)) {
              if (isFinite(value[key])) {
                value[key] = +value[key];
              }
              if (this._outputDomains.hasOwnProperty(key)) {
                this._outputDomains[key]['domain'].push(value[key]);
                this._outputDomains[key]['group_name'].push(value['group_name']);
              }
            }
          }
          if (!this._countryGroupData[value['group_name']]) {
            this._countryGroupData[value['group_name']] = value['group_name'];
          }
          this._globalModelData[value.id] = value;
          this._outputList.push({
            code: value.id,
            name: value.name,
            group: value.group_name
          });
          this._outputUIList.push(value.name);
        });
        resolve({
          _outputDomains: this._outputDomains,
          _globalModelData: this._globalModelData
        });
      });
    });
    this._outputDataProm$ = Observable.fromPromise(promisedData);
  }
  setPoliciesData(data) {
    // this._policyInfoObj = data;
    const chartConf = this.getChartsConf();
    const policyList = chartConf.policyList;
    const policyIds = policyList.map((val) => {
      return val.id;
    });
    let out;
    let key: any;
    let str;
    for (let i = 0; i < data.length; i++) {
      if (i === 0) { // initialize the country object.
        for (let k = 0; k < data[i].length; k++) {
          this._newPolicyGroupedByCountryObj[data[i][k][d3.keys(data[i][k])[0]]] = {}; // countryName = {}
        }
      }
      for (let j = 0; j < data[i].length; j++) {
        for (key in data[i][j]) {
          if (key === 'Asset losses label' || key === 'Wellbeing losses  label' ||
            key === 'Asset losses value' || key === 'Wellbeing losses value') {
						// skip it since new line characters are coming on certain headers
          } else {
            this._newPolicyGroupedByCountryObj[data[i][j][key]][policyIds[i]] = {}; // countryName["axfin"] = {}
            break;
          }
        }
        this._newPolicyGroupedByCountryObj[data[i][j][key]][policyIds[i]]['asset_losses_label'] = data[i][j]['Asset losses label'];
        this._newPolicyGroupedByCountryObj[data[i][j][key]][policyIds[i]]
          ['wellbeing_losses_label'] = data[i][j]['Wellbeing losses  label'];

        this._newPolicyGroupedByCountryObj[data[i][j][key]][policyIds[i]]['num_asset_losses_label'] = data[i][j]['Asset losses value'];
        this._newPolicyGroupedByCountryObj[data[i][j][key]][policyIds[i]]
          ['num_wellbeing_losses_label'] = data[i][j]['Wellbeing losses value'];

        str = this._newPolicyGroupedByCountryObj[data[i][j][key]][policyIds[i]]['asset_losses_label'];
        out = this.changeRelativeValue(str);
        this._newPolicyGroupedByCountryObj[data[i][j][key]][policyIds[i]]['rel_asset_losses_label'] = out[0];
        this._newPolicyGroupedByCountryObj[data[i][j][key]][policyIds[i]]['rel_num_asset_losses_label'] = out[1];

        str = this._newPolicyGroupedByCountryObj[data[i][j][key]][policyIds[i]]['wellbeing_losses_label'];
        out = this.changeRelativeValue(str);
        this._newPolicyGroupedByCountryObj[data[i][j][key]][policyIds[i]]['rel_wellbeing_losses_label'] = out[0];
        this._newPolicyGroupedByCountryObj[data[i][j][key]][policyIds[i]]['rel_num_wellbeing_losses_label'] = out[1];
      }
    }

    for (let i = 0; i < data.length; i++) {
      this._newPolicyGroupedByPolicyObj[policyIds[i]] = {}; // initialize the policy object. //axfin = {}
    }

    let idxPol = ''; // index for unique column name for that policy
    for (let i = 0; i < data.length; i++) {
      for (let j = 0; j < data[i].length; j++) {
        for (key in data[i][j]) {
          if (key === 'Asset losses label' || key === 'Wellbeing losses  label' ||
            key === 'Asset losses value' || key === 'Wellbeing losses value'){
						// skip it since new line characters are coming on certain headers
        } else {
          this._newPolicyGroupedByPolicyObj[policyIds[i]][data[i][j][key]] = {}; // axfin["countryName"] = {}
            idxPol = key;
            break; // break once you find the main column
          }
        }
        for (key in data[i][j]) {
          if (key === 'Asset losses label'){
            this._newPolicyGroupedByPolicyObj[policyIds[i]][data[i][j][idxPol]]['asset_losses_label'] = data[i][j]['Asset losses label'];
            str = this._newPolicyGroupedByPolicyObj[policyIds[i]][data[i][j][idxPol]]['asset_losses_label'];
            out = this.changeRelativeValue(str);
            this._newPolicyGroupedByPolicyObj[policyIds[i]][data[i][j][idxPol]]['rel_asset_losses_label'] = out[0];
            this._newPolicyGroupedByPolicyObj[policyIds[i]][data[i][j][idxPol]]['rel_num_asset_losses_label'] = out[1];
          } else if ( key === 'Wellbeing losses  label') {
            this._newPolicyGroupedByPolicyObj[policyIds[i]][data[i][j][idxPol]]
              ['wellbeing_losses_label'] = data[i][j]['Wellbeing losses  label'];
            str = this._newPolicyGroupedByPolicyObj[policyIds[i]][data[i][j][idxPol]]['wellbeing_losses_label'];
            out = this.changeRelativeValue(str);
            this._newPolicyGroupedByPolicyObj[policyIds[i]][data[i][j][idxPol]]['rel_wellbeing_losses_label'] = out[0];
            this._newPolicyGroupedByPolicyObj[policyIds[i]][data[i][j][idxPol]]['rel_num_wellbeing_losses_label'] = out[1];
          } else if ( key === 'Asset losses value') {
            this._newPolicyGroupedByPolicyObj[policyIds[i]][data[i][j][idxPol]]
              ['num_asset_losses_label'] = data[i][j]['Asset losses value'];
          } else if ( key === 'Wellbeing losses value') {
            this._newPolicyGroupedByPolicyObj[policyIds[i]][data[i][j][idxPol]]
              ['num_wellbeing_losses_label'] = data[i][j]['Wellbeing losses value'];
          }
        }
      }
    }
  }
  private _sortByKey(array, key) {
    array.sort((a, b) => {
      const x = a[key]; const y = b[key];
      return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });
  }
  unsubscribeOutputData() {
    this._outputDataSubs.unsubscribe();
  }
  updateInputCharts(containerId: string, sliderValues: any, selectedId?: string, groupName?: string) {
    const config = this._inputConfig;
    jQuery.each(config, (conf, inpObj) => {
      const ini = d3.select(`#${containerId} svg#` + conf + ' g.initial line');
      const iniEl = ini[0][0];
      if (iniEl) {
        let model;
        const inputId = containerId.indexOf('1') >= 0 ? 'input1' : 'input2';
        const input = inpObj[inputId];
        if (selectedId === 'global') {
          const data: Array<number> = [];
          this._sortByKey(input.distribGroupArr, 'distribution');
          input.distribGroupArr.forEach(val => data.push(val.distribution));
          const globalData = d3.mean(data);
          model = {};
          model[conf] = globalData;
        } else {
          model = this._globalModelData[selectedId];
        }
        sliderValues[conf + '_display_value'] = this.formatInputChartValues(model[conf], input);
        sliderValues[conf].value = model[conf];
        sliderValues[conf + '_value'] = model[conf] / (sliderValues[conf].max + sliderValues[conf].min) * 100;
        ini.attr('x1', function(d) {
            return input.x(+model[conf]);
          })
          .attr('y1', 0)
          .attr('x2', function(d) {
            return input.x(+model[conf]);
          })
          .attr('y2', input.height);
        // get the input config
        const brush = input.brush;
        const toUpd = input.forUpdate;
        // get the value of the current input from the model
        // and update the brush extent
        let extent = brush.extent()[1];
        if (groupName === 'GLOBAL' || !groupName) {
          extent = +model[conf];
        }
        brush.extent([0, extent]);
        const brushg = d3.selectAll(`#${containerId} svg#${conf} g.brush`);
        const me = this;
        brush.on('brush', me._inputBrushMoveEv.call(me, containerId, input));
        brushg.transition()
          .duration(750)
          .call(brush)
          .call(brush.event);

        brushg.style('pointer-events', 'none');
        const brushEl = brushg[0][0];
        brushEl.removeAllListeners();

        d3.selectAll(`#${containerId} g.brush > g.resize.w`).remove();
      }
      // remove existing initial marker
    });
  }
  updateOutputCharts(containerId: string, selectedId?: any, groupName?: string) {
    const domains = this.filterOutputDataByGroup(this._outputDomains, groupName);
    const me = this;
    jQuery.each(domains, (idx, outputData) => {
      const ini = d3.select(`#${containerId} svg#${idx} g.initial line`);
      const outputId = containerId.indexOf('1') >= 0 ? 'output1' : 'output2';
      const x = outputData[outputId].x;
      const height = outputData[outputId].height;
      let model;
      let avgDoll = 0;
      if (typeof selectedId === 'object') {
        model = selectedId['model'];
        avgDoll = Math.round((+model['macro_gdp_pc_pp']) * (+model['macro_pop']));
      } else if (selectedId === 'global') {
        const data: Array<number> = outputData.domain.sort((a, b) => {
          return a - b;
        });
        const globalData = d3.mean(data);
        model = {};
        model[idx] = globalData;
        avgDoll = this.calculateAVGGDPValue(idx);
      } else {
        model = this._globalModelData[selectedId];
        avgDoll = Math.round((+model['macro_gdp_pc_pp']) * (+model['macro_pop']));
      }
      ini.attr('x1', (d) => {
          return x(+model[idx]);
        })
        .attr('y1', 0)
        .attr('x2', (d) => {
          return x(+model[idx]);
        })
        .attr('y2', height);
      // get the input config
      const brush = outputData[outputId].brush;
      // get the value of the current input from the model
      // and update the brush extent
      let extent = brush.extent()[1];
      if (groupName === 'GLOBAL' || !groupName) {
        extent = +model[idx];
      }
      brush.extent([0, extent]);
      const output = outputData;
      const precision = +output.precision;
      const numericValue = (brush.extent()[1] * 100).toFixed(precision);
      const value = me.calculateGDPValues(containerId, idx, numericValue, avgDoll);
      this._outputDomains[idx]['chart'][containerId] = numericValue;
      jQuery(`#${containerId} #${idx} .text-number`).html(value);
      const brushg = d3.selectAll(`#${containerId} svg#${idx} g.brush`);
      brushg.transition()
        .duration(750)
        .call(brush)
        .call(brush.event);
      // remove w resize extent handle
      d3.selectAll(`#${containerId} g.brush > g.resize.w`).remove();
    });
  }
}
