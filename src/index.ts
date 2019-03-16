// can set a random number provider: https://www.npmjs.com/package/random-seed
// create arrays of basic types, e.g. numbers and strings etc.
// https://lostechies.com/johnteague/2014/05/21/autofixturejs/
// support exponential values in number spec
// copy functions and prototype from template

export interface Options {
    [key: string]: string | Options;
}

export class AutoFixture {
    public static createBoolean(): boolean {
        return Math.random() > 0.5;
    }

    public static createString(length?: number): string {
        // TODO use random-seed or randomatic
        length = length || 10;
        let result = '';
        const buffer = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV1234567890';
        for (let i = 0; i < length; i++) {
            const offset = Math.floor(Math.random() * buffer.length);
            result += buffer[offset];
        }
        return result;
    }

    public static createDecimal(): number {
        return 1000 * Math.random();
    }

    public static createDecimalBelow(upperBound: number): number {
        return upperBound - 1000 * Math.random();
    }

    public static createDecimalAbove(lowerBound: number): number {
        return lowerBound + 1000 * Math.random();
    }

    public static createDecimalBetween(lowerBound: number, upperBound: number): number {
        return lowerBound + (upperBound - lowerBound) * Math.random();
    }

    public static createInteger(): number {
        return AutoFixture.createIntegerBetween(0, 1000);
    }

    public static createIntegerBelow(upperBound: number): number {
        return AutoFixture.createIntegerBetween(upperBound - 1000, upperBound);
    }

    public static createIntegerAbove(lowerBound: number): number {
        return AutoFixture.createIntegerBetween(lowerBound, lowerBound + 1000);
    }

    public static createIntegerBetween(lowerBound: number, upperBound: number): number {
        return lowerBound + 1 + Math.floor(Math.random() * (upperBound - lowerBound - 1));
    }

    public static createDate(): Date {
        return new Date(AutoFixture.createIntegerBetween(2001, 2018), AutoFixture.createIntegerBetween(0, 11));
    }

    public populateMany<T extends object>(template: T, count?: number, options?: Options): T[] {
        count = count || 3;
        const results = [];
        for (let i = 0; i < count; i++) {
            results.push(this.populate(template, options));
        }
        return results;
    }

    public populate<T>(template: { [key: string]: any }, options?: Options): T {
        let childOptions: Options;
        let childType: string;
        let childSpec: string;
        const elementCount = 3;
        let childElementTemplate;
        // this.throwIfOptionsContainsFieldsNotIn(template, options); // typo, Contain

        const result = template;

        this.forEachProperty(result, (name: string) => {
            childType = this.actualTypeOfField(result, name);
            childOptions = (options as Options) && (options![name] as Options);
            childSpec = (options && (options[name] as string)) || typeof result[name];

            if (childSpec === 'date') {
                result[name] = this.createSimpleProperty(name, 'date', options);
            } else if (childSpec === 'skip') {
                delete result[name];
            } else if (childType === 'actualObject') {
                result[name] = this.populate(result[name], childOptions);
            } else if (childType === 'arrayOfObjects') {
                childElementTemplate = result[name][0];
                result[name] = this.populateMany(childElementTemplate, elementCount, childOptions);
            } else if (childType === 'arrayOfPrimitives') {
                result[name] = this.populateManyPrimitiveFromSpec(elementCount, childSpec);
            } else if (childType === 'emptyArray') {
                result[name] = [];
            } else {
                result[name] = this.createSimpleProperty(name, childType, options);
            }
        });

        return result as T;
    }

    private throwIfOptionsContainsFieldsNotIn<T>(template: T, options?: object): void {
        if (!options) {
            return;
        }
        this.forEachProperty(options, (name: string) => {
            if (!template.hasOwnProperty(name)) {
                throw Error("AutoFixture specifies field '" + name + "' that is not in the type");
            }
        });
    }

    // Object.keys is better, don't pass in value
    private forEachProperty(object: object, callback: (name: string) => void): void {
        for (const property in object) {
            if (object.hasOwnProperty(property)) {
                callback(property);
            }
        }
    }

    private actualTypeOfField(t: { [key: string]: any }, name: string): string {
        // use node_modules/kind-of
        const field = t[name];
        const type = typeof field;

        if (typeof Array.isArray !== 'undefined' && Array.isArray(field)) {
            if (field.length === 0) {
                return 'emptyArray';
            }
            if (Array.isArray(field[0])) {
                throw Error("Nested array '" + name + "' not supported");
            }
            return typeof field[0] === 'object' ? 'arrayOfObjects' : 'arrayOfPrimitives';
        }

        return type === 'object' ? 'actualObject' : type;
    }

    private createSimpleProperty(name: string, type: string, options?: Options): string | number | boolean | Date {
        if (this.optionsContain(name, options)) {
            return this.createPrimitiveFromOptions(name, type, options as Options);
        }

        this.throwOnUnsupportedType(type);
        return this.createPrimitiveFromSpec(type);
    }

    private optionsContain(name: string, options?: object): boolean {
        return options != null && options.hasOwnProperty(name);
    }

    private createPrimitiveFromOptions(name: string, type: string, options: Options): string | number | boolean | Date {
        const spec = options[name] as string;
        this.throwOnIncompatibleSpec(type, spec);
        return this.createPrimitiveFromSpec(spec);
    }

    private throwOnIncompatibleSpec(type: string, spec?: string): void {
        const booleanOk = type === 'boolean' && spec === 'boolean';
        const stringOk = type === 'string' && /string/.test(spec as string);
        const numberOk = type === 'number' && /number|integer/.test(spec as string);
        const decimalOk = type === 'number' && /decimal/.test(spec as string);
        const dateOk = type === 'date' && /date/i.test(spec as string);

        if (!spec || booleanOk || stringOk || numberOk || decimalOk || dateOk) {
            return;
        }

        throw Error(`AutoFixture spec '${spec}' not compatible with type '${type}'`);
    }

    private throwOnUnsupportedType(type: string): void {
        if (
            type === 'boolean' ||
            type === 'string' ||
            type === 'number' ||
            type === 'date' ||
            type === 'emptyArray' ||
            type === 'actualObject' ||
            type === 'arrayOfObjects'
        ) {
            return;
        }
        throw Error("AutoFixture cannot generate values of type '" + type + "'");
    }

    private populateManyPrimitiveFromSpec(count: number, spec: string): boolean[] | string[] | number[] {
        const result: any[] = [];
        for (let i = 0; i < count; i++) {
            result.push(this.createPrimitiveFromSpec(spec));
        }
        return result;
    }

    private createPrimitiveFromSpec(spec: string): boolean | string | number | Date {
        if (spec === 'boolean') {
            return AutoFixture.createBoolean();
        }
        if (spec === 'date') {
            return AutoFixture.createDate();
        }
        if (/string/.test(spec)) {
            return this.createStringFromSpec(spec);
        }
        if (/number/.test(spec) || /number/.test(spec)) {
            return this.createNumberFromSpec(spec);
        }
        throw new Error("Invalid type in autofixture spec '" + spec + "'");
    }

    private createStringFromSpec(spec: string): string {
        if (spec === 'string') {
            return AutoFixture.createString();
        }

        // string followed by length inside []
        const parsedString = /^\s*string\s*\[\s*(\d+)\s*\]\s*$/.exec(spec);
        if (parsedString) {
            const length = parseInt(parsedString[1], 10);
            return AutoFixture.createString(length);
        }

        throw new Error("Invalid string autofixture spec: '" + spec + "'");
    }

    private createNumberFromSpec(spec: string): number {
        return this.parseNumberSpec(spec)();
    }

    private parseNumberSpec(spec: string): () => number {
        const parsedSpec =
            this.parseSimpleNumericalSpec(spec) || this.parseAsOneSidedSpec(spec) || this.parseAsTwoSidedSpec(spec);

        if (parsedSpec) {
            return parsedSpec;
        }
        throw Error("Invalid number autofixture spec: '" + spec + "'");
    }

    private parseSimpleNumericalSpec(spec: string): (() => number) | undefined {
        if (this.isInteger(spec)) {
            return AutoFixture.createInteger;
        }
        if (spec === 'decimal') {
            return AutoFixture.createDecimal;
        }
        return undefined;
    }

    private isInteger(type: string): boolean {
        return type === 'number' || type === 'integer';
    }

    private parseAsOneSidedSpec(spec: string): (() => number) | undefined {
        // number or decimal, followed by < or >, followed by a real value
        const match = /^\s*(number|integer|decimal)\s*(\>|\<)\s*(\d*\.?\d+)\s*$/.exec(spec);
        if (!match) {
            return undefined;
        }

        const isUpperBound = match[2] === '<';
        const limit = parseFloat(match[3]);

        if (this.isInteger(match[1])) {
            this.validateIsInteger(match[3]);

            if (isUpperBound) {
                return () => {
                    return AutoFixture.createIntegerBelow(limit);
                };
            }

            return () => {
                return AutoFixture.createIntegerAbove(limit);
            };
        }

        if (isUpperBound) {
            return () => {
                return AutoFixture.createDecimalBelow(limit);
            };
        }

        return () => {
            return AutoFixture.createDecimalAbove(limit);
        };
    }

    private validateIsInteger(spec: string): void {
        const specContainsPeriod = spec.indexOf('.') >= 0;

        if (specContainsPeriod) {
            throw new Error('Invalid decimal autofixture spec contains real value: ' + spec);
        }
    }

    private parseAsTwoSidedSpec(spec: string): (() => number) | undefined {
        // a number, followed by <, followed by 'number' or 'decimal', followed by < and another number
        const match = /^\s*(\d*\.?\d+)\s*\<\s*(decimal|number|integer)\s*\<\s*(\d*\.?\d+)\s*$/.exec(spec);
        if (!match) {
            return undefined;
        }

        const lowerBoundAsString = match[1];
        const upperBoundAsString = match[3];

        const lowerBound = parseFloat(lowerBoundAsString);
        const upperBound = parseFloat(upperBoundAsString);

        if (lowerBound >= upperBound) {
            throw Error('Lower bound ' + lowerBound + ' must be lower than upper bound ' + upperBound);
        }

        if (this.isInteger(match[2])) {
            this.validateIsInteger(lowerBoundAsString);
            this.validateIsInteger(upperBoundAsString);

            return () => {
                return AutoFixture.createIntegerBetween(lowerBound, upperBound);
            };
        }

        return () => {
            return AutoFixture.createDecimalBetween(lowerBound, upperBound);
        };
    }
}
