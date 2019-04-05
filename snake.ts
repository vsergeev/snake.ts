/* snake.ts - April 2019 - Vanya A. Sergeev <v@sergeev.io> */

/******************************************************************************/
/* Common Enums and Types */
/******************************************************************************/

enum Color {
    Green = "#00ff00",
    Red = "#ff0000",
    Orange = "#ff8c00",
    Magenta = "#ff00ff",
}

enum Direction {
    Up,
    Down,
    Left,
    Right,
}

type Coordinate = [number, number];
type Dimensions = [number, number];

/******************************************************************************/
/* Coordinate Helper Functions */
/******************************************************************************/

function translate([x, y]: Coordinate, direction: Direction, [width, height]: Dimensions): Coordinate {
    switch (direction) {
        case Direction.Left: return [(x - 1 + width) % width, y];
        case Direction.Right: return [(x + 1) % width, y];
        case Direction.Up: return [x, (y - 1 + height) % height];
        case Direction.Down: return [x, (y + 1) % height];
    }
}

function distance([x0, y0]: Coordinate, [x1, y1]: Coordinate): number {
    return Math.sqrt((x0 - x1) ** 2 + (y0 - y1) ** 2);
}

function compass([x0, y0]: Coordinate, [x1, y1]: Coordinate): Direction {
    return (Math.abs(x0 - x1) > Math.abs(y0 - y1)) ?
        ((x0 - x1) > 0 ? Direction.Left : Direction.Right) :
        ((y0 - y1) > 0 ? Direction.Up : Direction.Down);
}

function equals([x0, y0]: Coordinate, [x1, y1]: Coordinate): boolean {
    return (x0 == x1) && (y0 == y1);
}

function selfCollision(e0: Coordinate[]): boolean {
    for (let i = 0; i < e0.length; i++) {
        for (let j = i + 1; j < e0.length; j++) {
            if (equals(e0[i], e0[j]))
                return true;
        }
    }
    return false;
}

function collision(e0: Coordinate[], e1: Coordinate[]): boolean {
    for (let i = 0; i < e0.length; i++) {
        for (let j = 0; j < e1.length; j++) {
            if (equals(e0[i], e1[j]))
                return true;
        }
    }
    return false;
}

/******************************************************************************/
/* Mini Game Engine */
/******************************************************************************/

/* Type to refer to class constructor for generic is(), find(), has() methods */
type Constructor<T> = { new(...args: any[]): T };

/* Game Entity */
abstract class Entity {
    abstract update(world: World): void;
    abstract locate(): Coordinate[];
    abstract render(screen: Screen): void;

    is<T extends Entity>(cls: Constructor<T>): this is T {
        return this instanceof cls;
    }
}

/* Game World */
class World {
    public dimensions: Dimensions;
    public frame: number;
    private _entities: Entity[];

    constructor(dimensions: Dimensions) {
        this.dimensions = dimensions;
        this.frame = 0;
        this._entities = [];
    }

    reset(): void {
        this.frame = 0;
        this._entities = [];
    }

    add(entity: Entity): void {
        this._entities.push(entity);
    }

    remove(entity: Entity): void {
        this._entities = this._entities.filter(e => e !== entity);
    }

    find<T extends Entity>(cls: Constructor<T>): T | null {
        const e = this._entities.find(e => e instanceof cls);
        return e ? <T>e : null;
    }

    has<T extends Entity>(cls: Constructor<T>): boolean {
        return this._entities.some(e => e instanceof cls);
    }

    update(): void {
        for (const entity of this._entities)
            entity.update(this);

        this.frame++;
    }

    detectCollisions(): [Entity, Entity][] {
        const collisions: [Entity, Entity][] = [];

        for (let i = 0; i < this._entities.length; i++) {
            if (selfCollision(this._entities[i].locate()))
                collisions.push([this._entities[i], this._entities[i]]);

            for (let j = i + 1; j < this._entities.length; j++) {
                if (collision(this._entities[i].locate(), this._entities[j].locate()))
                    collisions.push([this._entities[i], this._entities[j]]);
            }
        }

        return collisions;
    }

    render(screen: Screen): void {
        screen.clear();

        for (const entity of this._entities)
            entity.render(screen);

        screen.render();
    }

    getRandomPosition(radius: number, loop = false): Coordinate | null {
        const [width, height] = this.dimensions;

        do {
            /* Generate a random coordinate */
            const position: Coordinate = [
                Math.floor(radius + Math.random() * (width - radius)),
                Math.floor(radius + Math.random() * (height - radius))
            ];

            /* Check it is radius away from every entity */
            if (this._entities.every(e => distance(position, e.locate()[0]) > radius))
                return position;
        } while (loop);

        return null;
    }
}

/* Game Screen */
interface Screen {
    width: number;
    height: number;

    clear(): void;
    drawPixel(coord: Coordinate, color: Color): void;
    drawStatus(text: string): void;
    render(): void;

    reset(): void;
    showModal(title: string, text: string): void;

    bindInputs(keyHandler: (direction: Direction) => void, enterHandler: () => void, quitHandler: () => void): void;
}

/******************************************************************************/
/* Game Entity Implementations */
/******************************************************************************/

class SnakeEntity extends Entity {
    private _position: Coordinate[];
    private _direction: Direction;
    private _grow: boolean;

    constructor([x, y]: Coordinate, length: number) {
        super();
        this._position = Array.from(Array(length).keys()).map(i => [x - i, y]);
        this._direction = Direction.Right;
        this._grow = false;
    }

    update(world: World): void {
        /* Translate */
        this._position.unshift(translate(this._position[0], this._direction, world.dimensions));
        this._position.pop();

        /* Grow */
        if (this._grow) {
            this._position.unshift(translate(this._position[0], this._direction, world.dimensions));
            this._grow = false;
        }
    }

    locate(): Coordinate[] {
        return this._position;
    }

    render(screen: Screen): void {
        for (const coord of this._position)
            screen.drawPixel(coord, Color.Green);
    }

    /*******************/
    /* Special Methods */
    /*******************/

    handleKey(direction: Direction): void {
        /* Ignore existing and reversal directions */
        if ((this._direction == Direction.Left || this._direction == Direction.Right) &&
            (direction == Direction.Left || direction == Direction.Right))
            return;
        if ((this._direction == Direction.Up || this._direction == Direction.Down) &&
            (direction == Direction.Up || direction == Direction.Down))
            return;

        this._direction = direction;
    }

    grow(): void {
        this._grow = true;
    }
}

class AppleEntity extends Entity {
    private _position: Coordinate;
    private _lifetime: number;

    constructor(position: Coordinate, lifetime: number) {
        super();
        this._position = position;
        this._lifetime = lifetime;
    }

    update(world: World): void {
        if (--this._lifetime == 0)
            world.remove(this);
    }

    locate(): Coordinate[] {
        return [this._position];
    }

    render(screen: Screen): void {
        screen.drawPixel(this._position, Color.Red);
    }
}

class OrangeEntity extends Entity {
    private _position: Coordinate;
    private _lifetime: number;

    constructor(position: Coordinate, lifetime: number) {
        super();
        this._position = position;
        this._lifetime = lifetime;
    }

    update(world: World): void {
        if (--this._lifetime == 0)
            world.remove(this);
    }

    locate(): Coordinate[] {
        return [this._position];
    }

    render(screen: Screen): void {
        screen.drawPixel(this._position, Color.Orange);
    }
}

class MonsterEntity extends Entity {
    private _position: Coordinate[];
    private _interval: number;

    constructor([x, y]: Coordinate, interval: number) {
        super();
        this._position = [[x, y], [x + 1, y + 1], [x - 1, y - 1], [x - 1, y + 1], [x + 1, y - 1]];
        this._interval = interval;
    }

    update(world: World): void {
        /* Only move every interval frames */
        if ((world.frame % this._interval) !== 0)
            return;

        /* Find the apple, orange, and snake in the world */
        const apple = world.find(AppleEntity);
        const orange = world.find(OrangeEntity);
        const snake = world.find(SnakeEntity);

        /* Determine closest target, preferring food */
        let target: Entity;
        if (apple && orange)
            target = (distance(this.locate()[0], apple.locate()[0]) < distance(this.locate()[0], orange.locate()[0])) ?
                apple : orange;
        else if (apple || orange)
            target = apple! || orange!;
        else if (snake)
            target = snake;
        else
            return;

        /* Move towards target */
        const direction = compass(this.locate()[0], target.locate()[0]);
        this._position = this._position.map(coord => translate(coord, direction, world.dimensions));
    }

    locate(): Coordinate[] {
        return this._position;
    }

    render(screen: Screen): void {
        for (const coord of this._position)
            screen.drawPixel(coord, Color.Magenta);
    }
}

/******************************************************************************/
/* Screen Implementation */
/******************************************************************************/

import * as blessed from "blessed";

class BlessedScreen implements Screen {
    public width: number;
    public height: number;
    private _screen: blessed.Widgets.Screen;
    private _modalBox: blessed.Widgets.BoxElement;
    private _statusBox: blessed.Widgets.BoxElement;
    private _colors: { [color: string]: string };

    constructor() {
        this._screen = blessed.screen({ smartCSR: true });
        this.width = <number>this._screen.width;
        this.height = <number>this._screen.height - 1;

        this._modalBox = blessed.box({
            top: 'center', left: 'center',
            width: 'shrink', height: 'shrink',
            content: "",
            align: 'center',
            tags: true,
            border: { type: 'line' },
            style: {
                fg: 'white',
                bg: 'black',
                // bold: true,
                border: { fg: '#f0f0f0' },
            }
        });

        this._statusBox = blessed.box({
            bottom: 0, left: 'left',
            width: this.width, height: 1,
            content: "",
            style: {
                fg: 'white',
                bg: 'black',
                bold: true,
            }
        });

        this._screen.append(this._statusBox);

        /* Precompute color attribute strings */
        this._colors = {}
        for (const color in Color)
            this._colors[Color[color]] = <string>((<any>blessed).helpers.attrToBinary({ 'fg': Color[color] }));
    }

    reset(): void {
        /* Remove the modal */
        this._screen.remove(this._modalBox);

        /* Clear the status */
        this._statusBox.setContent("");

        /* Clear the screen */
        this.clear();
    }

    clear(): void {
        this._screen.clearRegion(0, this.width, 0, this.height);
    }

    drawPixel([x, y]: Coordinate, color: Color): void {
        this._screen.fillRegion(this._colors[color], '█', x, x + 1, y, y + 1);
    }

    drawStatus(text: string): void {
        this._statusBox.setContent(text);
    }

    render(): void {
        this._screen.render();
    }

    showModal(title: string, text: string): void {
        this._modalBox.setContent(`{bold}${title}{/bold}\n` + text);
        this._screen.append(this._modalBox);
        this._screen.render();
    }

    bindInputs(keyHandler: (direction: Direction) => void, enterHandler: () => void, quitHandler: () => void): void {
        this._screen.key('up', () => { keyHandler(Direction.Up); });
        this._screen.key('down', () => { keyHandler(Direction.Down); });
        this._screen.key('left', () => { keyHandler(Direction.Left); });
        this._screen.key('right', () => { keyHandler(Direction.Right); });
        this._screen.key('enter', enterHandler);
        this._screen.key(['escape', 'q', 'C-c'], quitHandler);
    }
}

/******************************************************************************/
/* Top-level Game */
/******************************************************************************/

/* Game Parameters */
const GAME_TICK_INTERVAL = 100;
const GAME_TICKS_PER_SECOND = (1000 / GAME_TICK_INTERVAL);
const GAME_SNAKE_INITIAL_LENGTH = 3;
const GAME_MONSTER_INTERVAL = 2;
const GAME_PLACEMENT_RADIUS = 10;
const GAME_PLACEMENT_INTERVAL = 5 * GAME_TICKS_PER_SECOND;
const GAME_APPLE_PROBABILITY = 0.80;
const GAME_ORANGE_PROBABILITY = 0.15;
const GAME_APPLE_LIFETIME = 15 * GAME_TICKS_PER_SECOND;
const GAME_ORANGE_LIFETIME = 7 * GAME_TICKS_PER_SECOND;
const GAME_APPLE_POINTS = 1;
const GAME_ORANGE_POINTS = 3;

class SnakeGame {
    private _world: World;
    private _screen: Screen;
    private _timer: NodeJS.Timer | null;
    private _score: number;

    constructor(screen: Screen) {
        this._world = new World([screen.width, screen.height]);
        this._screen = screen;
        this._timer = null;
        this._score = 0;

        this._screen.bindInputs(this.handleKey.bind(this), this.handleEnter.bind(this), this.handleQuit.bind(this));

        /* Show welcome modal */
        this._screen.showModal("Welcome to Snake!", `\nApples are worth ${GAME_APPLE_POINTS}.\nOranges are worth ${GAME_ORANGE_POINTS}.\nAvoid the hungry monster.\n\nPress enter to start.`);
    }

    start(): void {
        /* Reset state and world */
        this._score = 0;
        this._world.reset();
        this._screen.reset();

        /* Add a snake and monster to the world */
        const snakePosition = this._world.getRandomPosition(GAME_PLACEMENT_RADIUS, true);
        const monsterPosition = this._world.getRandomPosition(GAME_PLACEMENT_RADIUS, true);
        this._world.add(new SnakeEntity(snakePosition!, GAME_SNAKE_INITIAL_LENGTH));
        this._world.add(new MonsterEntity(monsterPosition!, GAME_MONSTER_INTERVAL));

        /* Start tick timer */
        this._timer = setInterval(this.handleTick.bind(this), GAME_TICK_INTERVAL);
    }

    stop(): void {
        /* Stop tick timer */
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }

        /* Show game over modal */
        this._screen.showModal("Game Over", `\nYour score is ${this._score}.\n\nPress enter to restart.`);
    }

    handleTick(): void {
        /* Random placement of apple & orange */
        if ((this._world.frame % GAME_PLACEMENT_INTERVAL) == 0) {
            if (!this._world.has(AppleEntity) && Math.random() < GAME_APPLE_PROBABILITY) {
                const position = this._world.getRandomPosition(GAME_PLACEMENT_RADIUS);
                if (position)
                    this._world.add(new AppleEntity(position, GAME_APPLE_LIFETIME));
            }

            if (!this._world.has(OrangeEntity) && Math.random() < GAME_ORANGE_PROBABILITY) {
                const position = this._world.getRandomPosition(GAME_PLACEMENT_RADIUS);
                if (position)
                    this._world.add(new OrangeEntity(position, GAME_ORANGE_LIFETIME));
            }
        }

        /* Update the world */
        this._world.update();

        /* Handle collisions */
        for (const [e0, e1] of this._world.detectCollisions()) {
            if (e0.is(SnakeEntity) && e1.is(SnakeEntity)) {
                this.stop();
            } else if (e0.is(SnakeEntity) && e1.is(MonsterEntity)) {
                this.stop();
            } else if (e0.is(SnakeEntity) && e1.is(AppleEntity)) {
                e0.grow();
                this._score += GAME_APPLE_POINTS;
                this._world.remove(e1);
            } else if (e0.is(SnakeEntity) && e1.is(OrangeEntity)) {
                e0.grow();
                this._score += GAME_ORANGE_POINTS;
                this._world.remove(e1);
            } else if (e0.is(MonsterEntity) && e1.is(AppleEntity)) {
                this._world.remove(e1);
            } else if (e0.is(MonsterEntity) && e1.is(OrangeEntity)) {
                this._world.remove(e1);
            }
        }

        /* Draw current score */
        this._screen.drawStatus(`Score: ${this._score}`);

        /* Render the world */
        this._world.render(this._screen);
    }

    handleKey(direction: Direction): void {
        const snake = this._world.find(SnakeEntity);
        if (snake)
            snake.handleKey(direction);
    }

    handleEnter(): void {
        if (!this._timer)
            this.start();
    }

    handleQuit(): void {
        process.exit(0)
    }
}

/******************************************************************************/
/* Entry Point */
/******************************************************************************/

const game = new SnakeGame(new BlessedScreen());
