// Copyright (c) 2020 Cryptogogue, Inc. All Rights Reserved.

import { Transaction, TRANSACTION_TYPE }    from './Transaction';
import { TransactionFormController }        from './TransactionFormController';
import { FIELD_CLASS }                      from './TransactionFormFieldControllers';
import { Binding, MethodBinding }           from 'cardmotron';
import { assert, randomBytes, util }        from 'fgc';
import _                                    from 'lodash';
import { action, computed, extendObservable, observable, observe, reaction, runInAction } from 'mobx';
import { observer }                         from 'mobx-react';

//================================================================//
// CraftingFormController
//================================================================//
export class CraftingFormController extends TransactionFormController {

    @observable binding             = new Binding ();
    @observable invocations         = [];
    @observable assetsUtilized      = {}; // reverse lookup into invocation and param

    //----------------------------------------------------------------//
    @action
    addBatchInvocation ( methodName, selection ) {

        const invocation = this.makeInvocation ( methodName );
        const method = this.binding.methodsByName [ methodName ];
        const paramName = Object.keys ( method.assetArgs )[ 0 ];

        const invocations = this.invocations.slice ( 0 );
        const assetsUtilized = _.cloneDeep ( this.assetsUtilized );

        for ( let assetID in selection ) {

            if ( assetsUtilized [ assetID ]) continue;

            const invocation = this.makeInvocation ( methodName );
            invocation.assetParams [ paramName ] = assetID;
            invocation.assetsUtilized [ assetID ] = true;
            invocations.push ( invocation );
            
            assetsUtilized [ assetID ] = true;
        }

        this.invocations = invocations;
        this.assetsUtilized = assetsUtilized;
        this.validate ();
    }

    //----------------------------------------------------------------//
    @action
    addInvocation ( methodName ) {

        this.invocations.push ( this.makeInvocation ( methodName ));
        this.validate ();
        return this.invocations [ this.invocations.length - 1 ]; // because mobX
    }

    //----------------------------------------------------------------//
    @computed get
    canAddInvocation () {

        for ( let invocation of this.invocations ) {
            if (( invocation.hasErrors ) || ( invocation.hasParams === false )) return false;
        }
        return true;
    }

    //----------------------------------------------------------------//
    constructor ( appState, inventory, singleInvocation ) {
        super ();

        this.inventory = inventory;
        this.initialize ( appState, TRANSACTION_TYPE.RUN_SCRIPT );

        extendObservable ( this, {
            singleInvocation: singleInvocation || false,
        });

        this.cancelBindingReaction = reaction (
            () => {
                return {
                    assets: this.inventory.assets,
                    assetsUtilized: _.cloneDeep ( this.assetsUtilized ), // _cloneDeep necessary because of use in callback
                };
            },
            ( params ) => {
                this.refreshBinding ();
            }
        );
    }

    //----------------------------------------------------------------//
    filter ( assetID, invocation ) {

        if ( invocation && invocation.assetsUtilized [ assetID ]) return true;
        if ( this.assetsUtilized [ assetID ] === true ) return false;

        return true;
    }

    //----------------------------------------------------------------//
    finalize () {

        this.cancelBindingReaction ();
    }

    //----------------------------------------------------------------//
    @computed get
    hasErrors () {

        for ( let invocation of this.invocations ) {
            if ( invocation.hasErrors ) return true;
        }
        return false;
    }

    //----------------------------------------------------------------//
    isSelected ( invocation, paramName, assetID ) {

        return ( invocation.assetParams [ paramName ] === assetID );
    }

    //----------------------------------------------------------------//
    isUtilized ( assetID ) {

        return ( this.assetsUtilized [ assetID ] === true );
    }

    //----------------------------------------------------------------//
    @action
    makeInvocation ( methodName ) {

        const method = this.binding.methodsByName [ methodName ];
        const methodBinding =  new MethodBinding ( this.inventory.schema, method );

        methodBinding.rebuild (
            this.inventory.assets,
            ( assetID ) => { return this.filter ( assetID )}
        );

        const assetParams = {};
        for ( let paramName in method.assetArgs ) {
            assetParams [ paramName ] = false;
        }

        const constParams = {};
        for ( let paramName in method.constArgs ) {
            constParams [ paramName ] = {
                type:       'STRING',
                value:      '',
            };
        }

        const invocation = {
            method:             method,
            assetParams:        assetParams,
            constParams:        constParams,
            methodBinding:      methodBinding,
            assetsUtilized:     {},
            hasParams:          false,
            hasErrors:          false,
        };

        return invocation;
    }

    //----------------------------------------------------------------//
    @action
    refreshBinding () {

        this.binding.rebuild (
            this.inventory.schema,
            this.inventory.assets,
            ( assetID ) => { return this.filter ( assetID )}
        );

        for ( let invocation of this.invocations ) {
            invocation.methodBinding.rebuild ( 
                this.inventory.assets,
                ( assetID ) => { return this.filter ( assetID, invocation )}
            );
        }
    }

    //----------------------------------------------------------------//
    @action
    removeInvocation ( index ) {

        const invocation = this.invocations [ index ];
        for ( let paramName in invocation.assetParams ) {
            const paramValue = invocation.assetParams [ paramName ];
            delete this.assetsUtilized [ paramValue ];
        }
        this.invocations.splice ( index, 1 );
        this.validate ();
    }

    //----------------------------------------------------------------//
    @action
    reset () {
        this.invocations = [];
        this.assetsUtilized = {};
    }

    //----------------------------------------------------------------//
    @action
    setAssetParam ( invocation, paramName, assetID ) {

        const prevValue = invocation.assetParams [ paramName ];
        if ( assetID === prevValue ) return;

        if ( prevValue === true ) {
            delete this.assetsUtilized [ prevValue ];
            delete invocation.assetsUtilized [ prevValue ];
        }

        invocation.assetParams [ paramName ] = assetID;

        if ( assetID !== false ) {
            this.assetsUtilized [ assetID ] = true;
            invocation.assetsUtilized [ assetID ] = true;
        }
        this.validate ();
    }

    //----------------------------------------------------------------//
    @action
    setConstParam ( invocation, paramName, value ) {

        invocation.constParams [ paramName ].value = value;
        this.validate ();
    }

    //----------------------------------------------------------------//
    virtual_checkComplete () {

        for ( let invocation of this.invocations ) {

            let hasParams = true;

            for ( let paramName in invocation.assetParams ) {
                if ( invocation.assetParams [ paramName ] === false ) {
                    hasParams = false;
                    break;
                }
            }
            invocation.hasParams = hasParams;
            invocation.hasErrors = hasParams ? !invocation.methodBinding.checkParams ( invocation.assetParams ) : false;
        }
        return (( this.invocations.length > 0 ) && ( this.canAddInvocation ));
    }

    //----------------------------------------------------------------//
    virtual_composeBody () {

        let weight = 1;
        let maturity = 0; 

        for ( let invocation of this.invocations ) {
            const method = invocation.method;
            weight += method.weight;
            maturity = maturity < method.maturity ? method.maturity : maturity;
        }

        const body = this.formatBody ();

        const invocations = [];
        for ( let invocation of this.invocations ) {

            const method = invocation.method;

            invocations.push ({
                methodName:         method.name,
                weight:             method.weight,
                maturity:           method.maturity,
                assetParams:        invocation.assetParams,
                constParams:        invocation.constParams,
            });
        }

        body.invocations    = invocations;
        body.weight         = weight;
        body.maturity       = maturity;
        return body;
    }

    //----------------------------------------------------------------//
    virtual_decorateTransaction ( transaction ) {

        transaction.setAssetsUtilized ( Object.keys ( this.assetsUtilized ));
    }
}
