package com.hanversion.bilimusic;

import static org.junit.Assert.*;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import org.junit.Test;

public class RangeResponseInputStreamTest {
    private final byte[] audio = new byte[]{11, 22, 33, 44};

    @Test public void webViewSkipDoesNotDiscardPartialResponse() throws Exception {
        InputStream stream = RangeResponseInputStream.wrap(new ByteArrayInputStream(audio),
            "bytes=3178496-", 206, "bytes 3178496-3178499/3178500", 4);
        assertEquals(3178500, stream.available());
        assertEquals(3178496, stream.skip(3178496));
        assertEquals(4, stream.available());
        assertArrayEquals(audio, stream.readAllBytes());
    }

    @Test public void boundedRangeCanSkipPrefixInSeveralCalls() throws Exception {
        InputStream stream = new RangeResponseInputStream(new ByteArrayInputStream(audio), 100, 4);
        assertEquals(40, stream.skip(40));
        assertEquals(64, stream.available());
        assertEquals(60, stream.skip(60));
        assertArrayEquals(audio, stream.readAllBytes());
    }

    @Test public void directReadWorksWhenWebViewDoesNotSkip() throws Exception {
        InputStream stream = new RangeResponseInputStream(new ByteArrayInputStream(audio), 100, 4);
        assertArrayEquals(audio, stream.readAllBytes());
        assertEquals(0, stream.available());
    }

    @Test public void largeOffsetsAvoidIntegerOverflow() throws Exception {
        long offset = 3L * 1024 * 1024 * 1024;
        InputStream stream = new RangeResponseInputStream(new ByteArrayInputStream(audio), offset, 4);
        assertEquals(0, stream.available());
        assertEquals(offset, stream.skip(offset));
        assertArrayEquals(audio, stream.readAllBytes());
    }

    @Test public void fullResponseAndOtherRangeFormsStayUnwrapped() {
        InputStream body = new ByteArrayInputStream(audio);
        assertSame(body, RangeResponseInputStream.wrap(body, "bytes=100-", 200, null, 4));
        assertSame(body, RangeResponseInputStream.wrap(body, "bytes=-4", 206, "bytes 100-103/104", 4));
        assertSame(body, RangeResponseInputStream.wrap(body, "bytes=100-103,200-203", 206, "bytes 100-103/204", 4));
        assertSame(body, RangeResponseInputStream.wrap(body, "bytes=100-", 206, "bytes 101-104/105", 4));
    }
}
