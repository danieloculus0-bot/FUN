#!/usr/bin/env python3
"""
EMPEROR GAUNTLET
A one-file Pygame prototype.

Premise:
One unarmed psychopath in an Antarctic arena tries to survive and score as many
emperor penguin murders as possible. The simulation leans into likely failure:
freezing, slipping, falling through weak ice, exhaustion, and penguins mostly
choosing avoidance until the player provokes enough of them. Kill every one of these 
goddamned tuxedo wearing motherfuckers. 


Controls:
- WASD or Arrow Keys: move
- Left Shift: sprint
- Space: shove / grapple attempt
- R: restart after game over
- Esc: quit
"""

import math
import random
import sys
from dataclasses import dataclass

try:
    import pygame
except ImportError:
    print("Pygame is not installed.")
    print("Install it with: py -m pip install pygame")
    raise


WIDTH, HEIGHT = 1000, 640
FPS = 60
ARENA_W, ARENA_H = 2450, 1700

WHITE = (238, 244, 247)
SNOW = (220, 234, 240)
ICE = (178, 221, 234)
BLUE_ICE = (90, 174, 205)
DARK_ICE = (18, 57, 76)
BLACK = (8, 10, 12)
GRAY = (78, 88, 94)
DARK = (24, 30, 35)
RED = (210, 65, 65)
DARK_RED = (105, 20, 28)
ORANGE = (235, 155, 55)
YELLOW = (240, 216, 86)
GREEN = (88, 215, 122)
CYAN = (95, 238, 255)
PURPLE = (150, 100, 240)

PLAYER_RADIUS = 18
PENGUIN_RADIUS = 15
START_PENGUINS = 22
MAX_PENGUINS = 48

TEMP_LOSS_BASE = 0.018
TEMP_LOSS_BLIZZARD = 0.04
TEMP_LOSS_WET = 0.058


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def safe_norm(v):
    if v.length_squared() == 0:
        return pygame.Vector2(0, 0)
    return v.normalize()


def distance(a, b):
    return math.hypot(a.x - b.x, a.y - b.y)


@dataclass
class SnowDrift:
    rect: pygame.Rect


@dataclass
class Crack:
    rect: pygame.Rect
    depth: float


@dataclass
class IceHole:
    pos: pygame.Vector2
    radius: float


@dataclass
class Particle:
    pos: pygame.Vector2
    vel: pygame.Vector2
    life: int
    color: tuple
    size: int


@dataclass
class Stain:
    pos: pygame.Vector2
    radius: int
    life: int
    color: tuple


class Player:
    def __init__(self):
        self.pos = pygame.Vector2(170, 200)
        self.vel = pygame.Vector2(0, 0)
        self.facing = pygame.Vector2(1, 0)
        self.temp = 100.0
        self.health = 100.0
        self.stamina = 100.0
        self.wet_timer = 0
        self.shove_cd = 0
        self.slip_timer = 0
        self.alive = True
        self.cause = ""
        self.provocation = 0

    def update(self, keys, terrain_slow, wind, blizzard):
        if not self.alive:
            return

        move = pygame.Vector2(0, 0)
        if keys[pygame.K_LEFT] or keys[pygame.K_a]:
            move.x -= 1
        if keys[pygame.K_RIGHT] or keys[pygame.K_d]:
            move.x += 1
        if keys[pygame.K_UP] or keys[pygame.K_w]:
            move.y -= 1
        if keys[pygame.K_DOWN] or keys[pygame.K_s]:
            move.y += 1

        sprinting = keys[pygame.K_LSHIFT] or keys[pygame.K_RSHIFT]
        if sprinting and self.stamina > 8 and move.length_squared() > 0:
            accel = 0.72
            self.stamina -= 0.43
        else:
            accel = 0.43
            self.stamina += 0.22

        self.stamina = clamp(self.stamina, 0, 100)

        if move.length_squared() > 0:
            move = move.normalize()
            self.facing = move
            self.vel += move * accel * terrain_slow

        self.vel += wind * 0.012

        friction = 0.945 if terrain_slow >= 0.8 else 0.89
        if self.slip_timer > 0:
            friction = 0.973
            self.slip_timer -= 1
        self.vel *= friction

        self.pos += self.vel
        self.pos.x = clamp(self.pos.x, PLAYER_RADIUS, ARENA_W - PLAYER_RADIUS)
        self.pos.y = clamp(self.pos.y, PLAYER_RADIUS, ARENA_H - PLAYER_RADIUS)

        if self.shove_cd > 0:
            self.shove_cd -= 1

        loss = TEMP_LOSS_BASE
        if blizzard:
            loss += TEMP_LOSS_BLIZZARD
        if sprinting:
            loss -= 0.008
        if self.wet_timer > 0:
            self.wet_timer -= 1
            loss += TEMP_LOSS_WET

        self.temp = clamp(self.temp - loss, 0, 100)

        if self.temp <= 0:
            self.alive = False
            self.cause = "froze out after losing a very predictable thermodynamics argument"

        if self.health <= 0:
            self.alive = False
            self.cause = "got swarmed by furious tuxedo linebackers"

    def shove(self):
        if self.shove_cd == 0 and self.stamina >= 12:
            self.shove_cd = 28
            self.stamina -= 12
            self.provocation += 1
            return True
        return False

    def draw(self, surf, cam):
        p = self.pos - cam
        body = (210, 150, 90) if self.temp > 35 else (160, 185, 220)

        pygame.draw.circle(surf, (38, 42, 48), (int(p.x), int(p.y + 4)), PLAYER_RADIUS + 3)
        pygame.draw.circle(surf, body, (int(p.x), int(p.y)), PLAYER_RADIUS)
        pygame.draw.circle(surf, BLACK, (int(p.x), int(p.y)), PLAYER_RADIUS, 2)

        nose = self.pos + self.facing * 16 - cam
        pygame.draw.circle(surf, BLACK, (int(nose.x), int(nose.y)), 4)

        if self.shove_cd > 18:
            arc_pos = self.pos + self.facing * 36 - cam
            pygame.draw.circle(surf, ORANGE, (int(arc_pos.x), int(arc_pos.y)), 26, 3)


class Penguin:
    def __init__(self, x, y):
        self.pos = pygame.Vector2(x, y)
        self.vel = pygame.Vector2(random.uniform(-1, 1), random.uniform(-1, 1))
        self.hp = random.uniform(58, 76)
        self.fear = random.uniform(0.2, 0.7)
        self.aggression = random.uniform(0.05, 0.28)
        self.mass = random.uniform(0.9, 1.25)
        self.state = "wander"
        self.down = False
        self.counted = False
        self.down_timer = 0
        self.peck_cd = random.randint(0, 80)
        self.waddle_phase = random.random() * math.tau
        self.panic = 0

    def update(self, player, penguins, wind, blizzard, holes, cracks):
        if self.down:
            self.down_timer -= 1
            return

        to_player = player.pos - self.pos
        d_player = to_player.length() if to_player.length_squared() else 9999

        nearby = 0
        center = pygame.Vector2(0, 0)
        separation = pygame.Vector2(0, 0)
        for other in penguins:
            if other is self or other.down:
                continue
            d = distance(self.pos, other.pos)
            if d < 130:
                nearby += 1
                center += other.pos
            if 0 < d < 36:
                separation += (self.pos - other.pos).normalize() * (36 - d) * 0.018

        if nearby:
            center /= nearby

        mob_chance = self.aggression + player.provocation * 0.018 + nearby * 0.018
        if d_player < 80 and nearby >= 4 and random.random() < mob_chance * 0.045:
            self.state = "mob"
            self.panic = max(self.panic, 80)
        elif d_player < 155:
            self.state = "flee"
            self.panic = max(self.panic, 55)
        elif blizzard and nearby > 0:
            self.state = "huddle"
        else:
            if random.random() < 0.01:
                self.state = "wander"

        acc = pygame.Vector2(0, 0)

        if self.state == "flee":
            acc += -safe_norm(to_player) * (0.18 + self.fear * 0.22)
            if nearby:
                acc += safe_norm(center - self.pos) * 0.04
        elif self.state == "mob":
            acc += safe_norm(to_player) * 0.22
        elif self.state == "huddle" and nearby:
            acc += safe_norm(center - self.pos) * 0.12
            acc += wind * -0.018
        else:
            self.waddle_phase += 0.025
            acc += pygame.Vector2(math.cos(self.waddle_phase), math.sin(self.waddle_phase * 0.7)) * 0.045

        acc += separation
        acc += wind * 0.004

        if self.panic > 0:
            self.panic -= 1
            acc *= 1.25

        self.vel += acc
        max_speed = 3.0 if self.state in ("flee", "mob") else 1.55
        if self.vel.length() > max_speed:
            self.vel.scale_to_length(max_speed)

        self.vel *= 0.94
        self.pos += self.vel

        self.pos.x = clamp(self.pos.x, PENGUIN_RADIUS, ARENA_W - PENGUIN_RADIUS)
        self.pos.y = clamp(self.pos.y, PENGUIN_RADIUS, ARENA_H - PENGUIN_RADIUS)

        if self.peck_cd > 0:
            self.peck_cd -= 1

        for hole in holes:
            if distance(self.pos, hole.pos) < hole.radius * 0.72:
                self.down = True
                self.down_timer = 180
                return

        for crack in cracks:
            if crack.rect.collidepoint(self.pos.x, self.pos.y):
                if self.panic > 20 and random.random() < 0.045 * crack.depth:
                    self.down = True
                    self.down_timer = 180
                    return

    def damage(self, amount, push):
        self.hp -= amount
        self.vel += push / max(0.6, self.mass)
        self.panic = 100
        if self.hp <= 0 and not self.down:
            self.down = True
            self.down_timer = 240
            return True
        return False

    def draw(self, surf, cam):
        p = self.pos - cam
        if self.down:
            body_rect = pygame.Rect(int(p.x - 22), int(p.y - 10), 44, 20)
            pygame.draw.ellipse(surf, BLACK, body_rect)
            pygame.draw.ellipse(surf, WHITE, body_rect.inflate(-14, -6))
            pygame.draw.circle(surf, ORANGE, (int(p.x + 22), int(p.y)), 5)
            return

        wobble = math.sin(pygame.time.get_ticks() * 0.007 + self.waddle_phase) * 3
        body = pygame.Rect(int(p.x - 14), int(p.y - 21 + wobble), 28, 42)
        belly = pygame.Rect(int(p.x - 8), int(p.y - 11 + wobble), 16, 28)

        pygame.draw.ellipse(surf, BLACK, body)
        pygame.draw.ellipse(surf, WHITE, belly)
        pygame.draw.circle(surf, BLACK, (int(p.x), int(p.y - 26 + wobble)), 13)
        pygame.draw.circle(surf, WHITE, (int(p.x + 4), int(p.y - 29 + wobble)), 4)
        pygame.draw.circle(surf, BLACK, (int(p.x + 5), int(p.y - 29 + wobble)), 2)
        pygame.draw.polygon(
            surf,
            ORANGE,
            [
                (int(p.x + 11), int(p.y - 25 + wobble)),
                (int(p.x + 25), int(p.y - 21 + wobble)),
                (int(p.x + 11), int(p.y - 17 + wobble)),
            ],
        )
        pygame.draw.line(surf, ORANGE, (int(p.x - 8), int(p.y + 20)), (int(p.x - 16), int(p.y + 27)), 3)
        pygame.draw.line(surf, ORANGE, (int(p.x + 8), int(p.y + 20)), (int(p.x + 16), int(p.y + 27)), 3)

        if self.state == "mob":
            pygame.draw.circle(surf, RED, (int(p.x + 5), int(p.y - 29 + wobble)), 4, 1)


class Game:
    def __init__(self):
        self.reset()

    def reset(self):
        self.player = Player()
        self.penguins = []
        for _ in range(START_PENGUINS):
            self.penguins.append(Penguin(random.randint(500, ARENA_W - 200), random.randint(180, ARENA_H - 180)))

        self.drifts = [
            SnowDrift(pygame.Rect(360, 300, 270, 120)),
            SnowDrift(pygame.Rect(820, 1040, 360, 150)),
            SnowDrift(pygame.Rect(1420, 450, 300, 135)),
            SnowDrift(pygame.Rect(1850, 1180, 260, 150)),
            SnowDrift(pygame.Rect(2100, 650, 210, 105)),
        ]

        self.cracks = [
            Crack(pygame.Rect(690, 220, 28, 540), 0.8),
            Crack(pygame.Rect(1230, 780, 580, 24), 0.7),
            Crack(pygame.Rect(1730, 170, 24, 420), 0.6),
            Crack(pygame.Rect(410, 1240, 680, 24), 0.9),
            Crack(pygame.Rect(2040, 930, 30, 470), 1.0),
        ]

        self.holes = [
            IceHole(pygame.Vector2(1040, 470), 58),
            IceHole(pygame.Vector2(1540, 1120), 72),
            IceHole(pygame.Vector2(2200, 350), 52),
            IceHole(pygame.Vector2(540, 910), 48),
        ]

        self.particles = []
        self.stains = []
        self.score = 0
        self.falls = 0
        self.clock = 0
        self.wind_angle = random.uniform(0, math.tau)
        self.wind_strength = random.uniform(0.3, 1.0)
        self.blizzard_timer = 0
        self.message = "Objective: no weapons. Shove, survive, and discover why nature hates confidence."
        self.message_timer = 240
        self.game_over = False

    @property
    def blizzard(self):
        return self.blizzard_timer > 0

    def wind(self):
        return pygame.Vector2(math.cos(self.wind_angle), math.sin(self.wind_angle)) * self.wind_strength

    def terrain_slow(self):
        slow = 1.0
        for drift in self.drifts:
            if drift.rect.collidepoint(self.player.pos.x, self.player.pos.y):
                slow = min(slow, 0.48)
        return slow

    def add_particles(self, pos, color, amount=12, speed=3.0, size=3):
        for _ in range(amount):
            ang = random.random() * math.tau
            mag = random.uniform(0.4, speed)
            self.particles.append(
                Particle(
                    pos=pygame.Vector2(pos),
                    vel=pygame.Vector2(math.cos(ang), math.sin(ang)) * mag,
                    life=random.randint(20, 58),
                    color=color,
                    size=random.randint(1, size),
                )
            )

    def add_stain(self, pos, radius=18, color=DARK_RED):
        self.stains.append(Stain(pygame.Vector2(pos), radius, 900, color))

    def update(self):
        if self.game_over:
            return

        self.clock += 1

        if random.random() < 0.002 and not self.blizzard:
            self.blizzard_timer = random.randint(420, 900)
            self.wind_strength = random.uniform(1.2, 2.2)
            self.message = "Whiteout rolling in. Visibility drops. Your eyebrows reconsider their life choices."
            self.message_timer = 220

        if self.blizzard_timer > 0:
            self.blizzard_timer -= 1
            if self.blizzard_timer == 0:
                self.wind_strength = random.uniform(0.35, 1.0)
                self.wind_angle += random.uniform(-0.8, 0.8)

        if self.clock % 420 == 0:
            self.wind_angle += random.uniform(-0.65, 0.65)
            self.wind_strength = clamp(self.wind_strength + random.uniform(-0.25, 0.3), 0.25, 2.2)

        keys = pygame.key.get_pressed()
        self.player.update(keys, self.terrain_slow(), self.wind(), self.blizzard)

        self.check_environment()

        for penguin in self.penguins:
            penguin.update(self.player, self.penguins, self.wind(), self.blizzard, self.holes, self.cracks)

        self.handle_collisions()
        self.update_particles()

        if not self.player.alive:
            self.game_over = True
            self.message = f"Game over: {self.player.cause}."
            self.message_timer = 999999

    def check_environment(self):
        for hole in self.holes:
            d = distance(self.player.pos, hole.pos)
            if d < hole.radius * 0.78:
                self.player.alive = False
                self.player.cause = "fell through weak ice because confidence is not buoyancy"
                self.add_particles(self.player.pos, BLUE_ICE, 50, 5, 5)
                return
            elif d < hole.radius * 1.15 and self.player.vel.length() > 4.5:
                self.player.slip_timer = max(self.player.slip_timer, 35)
                self.player.wet_timer = max(self.player.wet_timer, 240)

        for crack in self.cracks:
            if crack.rect.collidepoint(self.player.pos.x, self.player.pos.y):
                speed = self.player.vel.length()
                if speed > 3.4 and random.random() < 0.06 * crack.depth:
                    self.player.slip_timer = 55
                    self.player.health -= random.uniform(3, 9)
                    self.add_particles(self.player.pos, WHITE, 14, 2.4, 3)
                    self.message = "You ate shit on a pressure crack. The ice remains undefeated."
                    self.message_timer = 130
                if speed > 5.8 and random.random() < 0.012 * crack.depth:
                    self.player.alive = False
                    self.player.cause = "vanished into a pressure crack like a cautionary pamphlet"
                    self.add_particles(self.player.pos, BLUE_ICE, 60, 5, 5)
                    return

    def handle_collisions(self):
        player = self.player
        if not player.alive:
            return

        for penguin in self.penguins:
            if penguin.down:
                continue

            delta = player.pos - penguin.pos
            d = delta.length()
            min_d = PLAYER_RADIUS + PENGUIN_RADIUS

            if 0 < d < min_d:
                n = delta.normalize()
                overlap = min_d - d
                player.pos += n * (overlap * 0.42)
                penguin.pos -= n * (overlap * 0.58)

                if penguin.state == "mob" and penguin.peck_cd == 0:
                    penguin.peck_cd = random.randint(35, 70)
                    player.health -= random.uniform(4, 9)
                    player.vel += n * random.uniform(1.5, 2.8)
                    self.add_particles(player.pos - n * 14, RED, 8, 2.3, 3)
                    self.add_stain(player.pos - n * 16, radius=random.randint(5, 10), color=DARK_RED)
                    self.message = "Pecked and flipper-slapped. Not lethal, just deeply embarrassing."
                    self.message_timer = 110

            if player.shove_cd > 18:
                reach = player.pos + player.facing * 42
                hit_delta = penguin.pos - reach
                if hit_delta.length() < 43:
                    facing_dot = safe_norm(penguin.pos - player.pos).dot(player.facing)
                    if facing_dot > 0.15:
                        push = safe_norm(penguin.pos - player.pos) * random.uniform(6.5, 10.0)
                        damage = random.uniform(22, 38)
                        down_now = penguin.damage(damage, push)
                        self.add_particles(penguin.pos, RED, 10, 2.5, 3)
                        self.add_stain(penguin.pos, radius=random.randint(7, 14), color=DARK_RED)
                        player.vel -= player.facing * 0.7
                        if down_now and not penguin.counted:
                            penguin.counted = True
                            self.score += 1
                            player.provocation += 2
                            self.message = random.choice([
                                "Penguin down. The rookery files a complaint.",
                                "Impact confirmed. Red snow, bad karma.",
                                "That one is not waddling for a minute.",
                                "One tuxedo pancake. Nature is judging you.",
                            ])
                            self.message_timer = 135

        for penguin in self.penguins:
            if penguin.down and not penguin.counted:
                penguin.counted = True
                self.score += 1
                self.falls += 1
                self.add_particles(penguin.pos, BLUE_ICE, 22, 3.6, 4)
                self.message = "A panicked penguin fell through bad ice. Technically a score, morally a mess."
                self.message_timer = 140

    def update_particles(self):
        for particle in self.particles[:]:
            particle.pos += particle.vel
            particle.vel *= 0.94
            particle.life -= 1
            if particle.life <= 0:
                self.particles.remove(particle)

        for stain in self.stains[:]:
            stain.life -= 1
            if stain.life <= 0:
                self.stains.remove(stain)

        living = sum(1 for p in self.penguins if not p.down)
        target = min(MAX_PENGUINS, START_PENGUINS + self.score // 2)
        if living < target and random.random() < 0.02:
            edge = random.choice(["top", "bottom", "left", "right"])
            if edge == "top":
                x, y = random.randint(80, ARENA_W - 80), 40
            elif edge == "bottom":
                x, y = random.randint(80, ARENA_W - 80), ARENA_H - 40
            elif edge == "left":
                x, y = 40, random.randint(80, ARENA_H - 80)
            else:
                x, y = ARENA_W - 40, random.randint(80, ARENA_H - 80)
            self.penguins.append(Penguin(x, y))

    def draw(self, screen):
        cam = pygame.Vector2(
            clamp(self.player.pos.x - WIDTH / 2, 0, ARENA_W - WIDTH),
            clamp(self.player.pos.y - HEIGHT / 2, 0, ARENA_H - HEIGHT),
        )

        screen.fill(ICE)

        for x in range(-80, WIDTH + 120, 80):
            for y in range(-80, HEIGHT + 120, 80):
                wx = int(x + ((cam.x * 0.18) % 80))
                wy = int(y + ((cam.y * 0.18) % 80))
                pygame.draw.circle(screen, SNOW, (wx, wy), 2)

        for drift in self.drifts:
            r = drift.rect.move(-cam.x, -cam.y)
            pygame.draw.ellipse(screen, WHITE, r)
            pygame.draw.ellipse(screen, SNOW, r, 3)

        for crack in self.cracks:
            r = crack.rect.move(-cam.x, -cam.y)
            pygame.draw.rect(screen, DARK_ICE, r, border_radius=8)
            pygame.draw.rect(screen, BLUE_ICE, r, 2, border_radius=8)

        for hole in self.holes:
            p = hole.pos - cam
            pygame.draw.circle(screen, DARK_ICE, (int(p.x), int(p.y)), int(hole.radius))
            pygame.draw.circle(screen, BLUE_ICE, (int(p.x), int(p.y)), int(hole.radius), 4)
            pygame.draw.circle(screen, BLACK, (int(p.x), int(p.y)), int(hole.radius * 0.55))

        for stain in self.stains:
            p = stain.pos - cam
            alpha_radius = max(2, int(stain.radius * clamp(stain.life / 900, 0.25, 1)))
            pygame.draw.circle(screen, stain.color, (int(p.x), int(p.y)), alpha_radius)

        for penguin in self.penguins:
            penguin.draw(screen, cam)

        self.player.draw(screen, cam)

        for particle in self.particles:
            p = particle.pos - cam
            pygame.draw.circle(screen, particle.color, (int(p.x), int(p.y)), particle.size)

        if self.blizzard:
            wind = self.wind()
            for i in range(140):
                sx = (i * 71 + pygame.time.get_ticks() * 0.7 * wind.x) % WIDTH
                sy = (i * 43 + pygame.time.get_ticks() * 0.7 * wind.y) % HEIGHT
                pygame.draw.line(screen, WHITE, (sx, sy), (sx - wind.x * 18, sy - wind.y * 18), 1)

        self.draw_hud(screen)

        if self.game_over:
            overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
            overlay.fill((0, 0, 0, 178))
            screen.blit(overlay, (0, 0))
            draw_text(screen, "EMPEROR GAUNTLET OVER", 50, RED, WIDTH // 2, HEIGHT // 2 - 95, center=True)
            draw_text(screen, f"Score: {self.score} penguins down", 28, WHITE, WIDTH // 2, HEIGHT // 2 - 32, center=True)
            draw_text(screen, self.player.cause, 21, WHITE, WIDTH // 2, HEIGHT // 2 + 10, center=True)
            draw_text(screen, "Press R to restart", 24, YELLOW, WIDTH // 2, HEIGHT // 2 + 62, center=True)

    def draw_hud(self, screen):
        pygame.draw.rect(screen, (15, 18, 22), (0, 0, WIDTH, 82))
        pygame.draw.line(screen, (66, 72, 82), (0, 82), (WIDTH, 82), 2)

        draw_text(screen, "EMPEROR GAUNTLET", 24, WHITE, 18, 12)
        draw_text(screen, f"Penguins down: {self.score}", 22, RED, 310, 13)
        draw_text(screen, f"Falls: {self.falls}", 20, CYAN, 560, 15)

        bar(screen, 18, 48, 190, 13, self.player.health / 100, RED, "HEALTH")
        bar(screen, 248, 48, 190, 13, self.player.temp / 100, CYAN, "TEMP")
        bar(screen, 478, 48, 190, 13, self.player.stamina / 100, GREEN, "STAMINA")

        wind = self.wind()
        arrow_center = pygame.Vector2(775, 52)
        pygame.draw.circle(screen, GRAY, arrow_center, 20, 2)
        end = arrow_center + safe_norm(wind) * 18
        pygame.draw.line(screen, YELLOW, arrow_center, end, 3)
        pygame.draw.circle(screen, YELLOW, end, 4)
        draw_text(screen, "WIND", 15, WHITE, 748, 14)
        draw_text(screen, "BLIZZARD" if self.blizzard else "CLEAR-ish", 18, YELLOW if self.blizzard else WHITE, 845, 42)

        if self.message_timer > 0:
            self.message_timer -= 1
            pygame.draw.rect(screen, BLACK, (80, HEIGHT - 44, WIDTH - 160, 32), border_radius=8)
            pygame.draw.rect(screen, YELLOW, (80, HEIGHT - 44, WIDTH - 160, 32), 2, border_radius=8)
            draw_text(screen, self.message, 17, WHITE, WIDTH // 2, HEIGHT - 28, center=True)


def bar(screen, x, y, w, h, pct, color, label):
    pct = clamp(pct, 0, 1)
    pygame.draw.rect(screen, (42, 45, 50), (x, y, w, h), border_radius=5)
    pygame.draw.rect(screen, color, (x, y, int(w * pct), h), border_radius=5)
    pygame.draw.rect(screen, WHITE, (x, y, w, h), 1, border_radius=5)
    draw_text(screen, label, 13, WHITE, x, y - 17)


def draw_text(surf, text, size, color, x, y, center=False):
    font = pygame.font.SysFont("consolas", size, bold=True)
    img = font.render(text, True, color)
    rect = img.get_rect()
    if center:
        rect.center = (x, y)
    else:
        rect.topleft = (x, y)
    surf.blit(img, rect)


def draw_start(screen):
    screen.fill((13, 18, 24))
    draw_text(screen, "EMPEROR GAUNTLET", 58, WHITE, WIDTH // 2, 115, center=True)
    draw_text(screen, "One unarmed man. A lot of penguins. Antarctica does most of the killing.", 22, CYAN, WIDTH // 2, 178, center=True)
    draw_text(screen, "Mostly realistic behavior: avoidance, huddling, panic, rare mobbing after provocation.", 20, WHITE, WIDTH // 2, 226, center=True)
    draw_text(screen, "Adult stylized violence: red snow bursts, knockdowns, falls, no detailed gore.", 20, RED, WIDTH // 2, 260, center=True)

    controls = [
        "WASD / Arrows: move",
        "Left Shift: sprint, burns stamina",
        "Space: shove / grapple attempt",
        "Avoid holes and pressure cracks",
        "Cold, wet clothing, and blizzards will end you faster than the birds",
    ]

    y = 330
    for line in controls:
        draw_text(screen, line, 22, WHITE, WIDTH // 2, y, center=True)
        y += 35

    draw_text(screen, "Press Space to start", 28, YELLOW, WIDTH // 2, 560, center=True)


def main():
    pygame.init()
    pygame.display.set_caption("Emperor Gauntlet")
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    clock = pygame.time.Clock()
    game = Game()
    started = False

    while True:
        clock.tick(FPS)

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()

            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    pygame.quit()
                    sys.exit()

                if not started and event.key == pygame.K_SPACE:
                    started = True

                elif started and event.key == pygame.K_SPACE and not game.game_over:
                    if game.player.shove():
                        game.add_particles(game.player.pos + game.player.facing * 40, ORANGE, 12, 3.2, 3)

                if event.key == pygame.K_r and game.game_over:
                    game = Game()
                    started = True

        if not started:
            draw_start(screen)
        else:
            game.update()
            game.draw(screen)

        pygame.display.flip()


if __name__ == "__main__":
    main()