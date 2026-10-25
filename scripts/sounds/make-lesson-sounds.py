import numpy as np, wave, sys
SR=44100
rng=np.random.default_rng(7)
def bell(f, dur, amp=1.0, bright=1.0):
    t=np.arange(int(SR*dur))/SR
    # Struck bell/glock: inharmonic partials, faster decay higher up.
    parts=[(1,1.0,2.2),(2.0,0.45*bright,3.5),(3.01,0.22*bright,5.0),(4.17,0.12*bright,7.0),(5.43,0.06*bright,9.0)]
    s=np.zeros_like(t)
    for ratio,a,dec in parts:
        s+=a*np.sin(2*np.pi*f*ratio*t+rng.uniform(0,6))*np.exp(-dec*t)
    att=np.minimum(1,t/0.004)
    rel=np.minimum(1,(dur-t)/(dur*0.35))  # fade each note out, no click
    return amp*s*att*rel
def place(buf, sig, at, pan=0.0):
    i=int(at*SR); n=min(len(sig), buf.shape[1]-i)
    l=np.cos((pan+1)*np.pi/4); r=np.sin((pan+1)*np.pi/4)
    buf[0,i:i+n]+=sig[:n]*l; buf[1,i:i+n]+=sig[:n]*r
def sparkle(buf, start, end, count, lo=3500, hi=7500, amp=0.07):
    for _ in range(count):
        at=rng.uniform(start,end); f=rng.uniform(lo,hi); d=0.12
        t=np.arange(int(SR*d))/SR
        s=np.sin(2*np.pi*f*t)*np.exp(-30*t)*np.minimum(1,t/0.002)*amp*rng.uniform(0.5,1)
        place(buf,s,at,rng.uniform(-0.8,0.8))
def swell(buf, at, dur, amp=0.05):
    n=int(SR*dur); noise=rng.normal(0,1,n)
    # crude high-pass by differencing, then a rising envelope: a soft "whoosh".
    hp=np.diff(noise,prepend=0)
    env=np.sin(np.linspace(0,np.pi,n))**2
    place(buf,hp*env*amp,at,0)
def write(name, buf):
    peak=np.max(np.abs(buf)); buf=buf/peak*0.7
    data=(np.clip(buf.T,-1,1)*32767).astype('<i2')
    with wave.open(name,'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())

# 1. Lesson complete: a rising major arpeggio (C6 E6 G6) landing on a C7 + E7
#    chord, with a light shimmer, about 1.6 s.
buf=np.zeros((2,int(SR*1.8)))
swell(buf,0.0,0.22,0.03)
notes=[(1046.5,0.00,-0.4),(1318.5,0.09,-0.1),(1568.0,0.18,0.2)]
for f,at,pan in notes: place(buf,bell(f,0.9,0.55),at,pan)
place(buf,bell(2093.0,1.5,0.6,0.8),0.29,0.0)
place(buf,bell(2637.0,1.4,0.32,0.6),0.30,0.3)
place(buf,bell(523.25,1.4,0.35,0.4),0.29,0.0)   # warm root under the chord
sparkle(buf,0.32,0.95,14)
fade=np.ones(buf.shape[1]); fade[-int(SR*0.25):]=np.linspace(1,0,int(SR*0.25))
write('lesson-complete.wav',buf*fade)

# 2. Streak up: a brighter two-step lift (G6 -> D7 + G7) with sparkles, ~1 s.
buf=np.zeros((2,int(SR*1.1)))
place(buf,bell(1568.0,0.6,0.5),0.0,-0.2)
place(buf,bell(2349.3,0.9,0.55,0.8),0.11,0.1)
place(buf,bell(3136.0,0.8,0.25,0.5),0.12,0.35)
sparkle(buf,0.12,0.6,12,4500,9000,0.06)
fade=np.ones(buf.shape[1]); fade[-int(SR*0.2):]=np.linspace(1,0,int(SR*0.2))
write('streak-up.wav',buf*fade)
