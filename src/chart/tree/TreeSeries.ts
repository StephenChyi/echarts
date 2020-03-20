/*
* Licensed to the Apache Software Foundation (ASF) under one
* or more contributor license agreements.  See the NOTICE file
* distributed with this work for additional information
* regarding copyright ownership.  The ASF licenses this file
* to you under the Apache License, Version 2.0 (the
* "License"); you may not use this file except in compliance
* with the License.  You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing,
* software distributed under the License is distributed on an
* "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
* KIND, either express or implied.  See the License for the
* specific language governing permissions and limitations
* under the License.
*/

import SeriesModel from '../../model/Series';
import Tree from '../../data/Tree';
import {encodeHTML} from '../../util/format';
import {
    SeriesOption,
    SymbolOptionMixin,
    BoxLayoutOptionMixin,
    RoamOptionMixin,
    LineStyleOption,
    ItemStyleOption,
    LabelOption,
    OptionDataValue
} from '../../util/types';
import List from '../../data/List';
import View from '../../coord/View';
import { LayoutRect } from '../../util/layout';

interface CurveLineStyleOption extends LineStyleOption{
    curveness?: number
}

export interface TreeSeriesNodeItemOption extends SymbolOptionMixin {
    name?: string

    itemStyle?: ItemStyleOption
    /**
     * Line style of the edge between node and it's parent.
     */
    lineStyle?: LineStyleOption
    label?: LabelOption

    emphasis?: {
        itemStyle?: ItemStyleOption
        lineStyle?: LineStyleOption
        label?: LabelOption
    }

    value?: OptionDataValue | OptionDataValue[]

    children?: TreeSeriesNodeItemOption[]

    collapsed?: boolean

    link?: string
    target?: string
}

export interface TreeSeriesOption extends
    SeriesOption, SymbolOptionMixin, BoxLayoutOptionMixin, RoamOptionMixin {
    type?: 'tree'

    hoverAnimation?: boolean

    layout?: 'orthogonal' | 'radial'

    edgeShape?: 'polyline' | 'curve'

    /**
     * Available when edgeShape is polyline
     */
    edgeForkPosition?: string | number

    nodeScaleRatio?: number

    /**
     * The orient of orthoginal layout, can be setted to 'LR', 'TB', 'RL', 'BT'.
     * and the backward compatibility configuration 'horizontal = LR', 'vertical = TB'.
     */
    orient?: 'LR' | 'TB' | 'RL' | 'BT' | 'horizontal' | 'vertical'

    expandAndCollapse?: boolean

    /**
     * The initial expanded depth of tree
     */
    initialTreeDepth?: number

    /**
     * Line style of links
     */
    lineStyle?: CurveLineStyleOption
    /**
     * Item style of nodes
     */
    itemStyle?: ItemStyleOption
    label?: LabelOption

    emphasis?: {
        lineStyle?: CurveLineStyleOption
        itemStyle?: ItemStyleOption
        label?: LabelOption
    }

    leaves?: {
        /**
         * Item style of leave nodes
         */
        itemStyle?: ItemStyleOption
        label?: LabelOption

        emphasis?: {
            itemStyle?: ItemStyleOption
            label?: LabelOption
        }
    }

    data?: TreeSeriesNodeItemOption[]
}

class TreeSeriesModel extends SeriesModel<TreeSeriesOption> {
    static readonly type = 'series.tree';

    // can support the position parameters 'left', 'top','right','bottom', 'width',
    // 'height' in the setOption() with 'merge' mode normal.
    static readonly layoutMode = 'box';

    coordinateSystem: View;

    layoutInfo: LayoutRect;

    /**
     * Init a tree data structure from data in option series
     * @param  option  the object used to config echarts view
     * @return storage initial data
     */
    getInitialData(option: TreeSeriesOption): List {

        //create an virtual root
        var root: TreeSeriesNodeItemOption = {
            name: option.name,
            children: option.data
        };

        var leaves = option.leaves || {};

        var tree = Tree.createTree(root, this, {
            leaves: leaves
        }, beforeLink);

        function beforeLink(nodeData: List) {
            nodeData.wrapMethod('getItemModel', function (model, idx) {
                var node = tree.getNodeByDataIndex(idx);
                var leavesModel = node.getLeavesModel();
                if (!node.children.length || !node.isExpand) {
                    model.parentModel = leavesModel;
                }
                return model;
            });
        }

        var treeDepth = 0;

        tree.eachNode('preorder', function (node) {
            if (node.depth > treeDepth) {
                treeDepth = node.depth;
            }
        });

        var expandAndCollapse = option.expandAndCollapse;
        var expandTreeDepth = (expandAndCollapse && option.initialTreeDepth >= 0)
            ? option.initialTreeDepth : treeDepth;

        tree.root.eachNode('preorder', function (node) {
            var item = node.hostTree.data.getRawDataItem(node.dataIndex) as TreeSeriesNodeItemOption;
            // Add item.collapsed != null, because users can collapse node original in the series.data.
            node.isExpand = (item && item.collapsed != null)
                ? !item.collapsed
                : node.depth <= expandTreeDepth;
        });

        return tree.data;
    }

    /**
     * Make the configuration 'orient' backward compatibly, with 'horizontal = LR', 'vertical = TB'.
     * @returns {string} orient
     */
    getOrient() {
        var orient = this.get('orient');
        if (orient === 'horizontal') {
            orient = 'LR';
        }
        else if (orient === 'vertical') {
            orient = 'TB';
        }
        return orient;
    }

    setZoom(zoom: number) {
        this.option.zoom = zoom;
    }

    setCenter(center: number[]) {
        this.option.center = center;
    }

    /**
     * @override
     */
    formatTooltip(dataIndex: number): string {
        var tree = this.getData().tree;
        var realRoot = tree.root.children[0];
        var node = tree.getNodeByDataIndex(dataIndex);
        var value = node.getValue();
        var name = node.name;
        while (node && (node !== realRoot)) {
            name = node.parentNode.name + '.' + name;
            node = node.parentNode;
        }
        return encodeHTML(name + (
            (isNaN(value as number) || value == null) ? '' : ' : ' + value
        ));
    }

    static defaultOption: TreeSeriesOption = {
        zlevel: 0,
        z: 2,
        coordinateSystem: 'view',

        // the position of the whole view
        left: '12%',
        top: '12%',
        right: '12%',
        bottom: '12%',

        // the layout of the tree, two value can be selected, 'orthogonal' or 'radial'
        layout: 'orthogonal',

        // value can be 'polyline'
        edgeShape: 'curve',

        edgeForkPosition: '50%',

        // true | false | 'move' | 'scale', see module:component/helper/RoamController.
        roam: false,

        // Symbol size scale ratio in roam
        nodeScaleRatio: 0.4,

        // Default on center of graph
        center: null,

        zoom: 1,

        orient: 'LR',

        symbol: 'emptyCircle',

        symbolSize: 7,

        expandAndCollapse: true,

        initialTreeDepth: 2,

        lineStyle: {
            color: '#ccc',
            width: 1.5,
            curveness: 0.5
        },

        itemStyle: {
            color: 'lightsteelblue',
            borderColor: '#c23531',
            borderWidth: 1.5
        },

        label: {
            show: true,
            color: '#555'
        },

        leaves: {
            label: {
                show: true
            }
        },

        animationEasing: 'linear',

        animationDuration: 700,

        animationDurationUpdate: 1000
    };
}

SeriesModel.registerClass(TreeSeriesModel);

export default TreeSeriesModel;