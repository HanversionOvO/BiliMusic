package com.hanversion.bilimusic;

import static org.junit.Assert.*;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

public class WebdavClientTest {
    private MockWebServer server;
    private WebdavClient client;
    private Map<String, String> headers;

    @Before public void setup() throws Exception {
        server = new MockWebServer();
        server.start();
        client = new WebdavClient();
        headers = new HashMap<>();
        headers.put("Authorization", "Basic dGVzdDpwYXNz");
    }

    @After public void cleanup() throws Exception {
        client.close();
        server.shutdown();
    }

    @Test public void propfindWorksWithoutCorsAndKeepsDepthAndAuthentication() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(207).setBody("<d:multistatus xmlns:d=\"DAV:\"/>"));
        headers.put("Depth", "0");
        headers.put("Content-Type", "application/xml; charset=utf-8");
        WebdavClient.Result result = client.request(server.url("/dav/").toString(), "PROPFIND", headers, "<d:propfind/>" );
        assertEquals(207, result.status);
        RecordedRequest request = server.takeRequest(2, TimeUnit.SECONDS);
        assertEquals("PROPFIND", request.getMethod());
        assertEquals("0", request.getHeader("Depth"));
        assertEquals(headers.get("Authorization"), request.getHeader("Authorization"));
        assertNull(request.getHeader("Origin"));
        assertEquals("<d:propfind/>", request.getBody().readUtf8());
    }

    @Test public void directoryCreationAndConditionalJsonRoundTripKeepEtag() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(201));
        assertEquals(201, client.request(server.url("/dav/bilimusic/").toString(), "MKCOL", headers, null).status);
        assertEquals("MKCOL", server.takeRequest().getMethod());
        String content = "{\"name\":\"安卓歌单 🎵\"}";
        headers.put("Content-Type", "application/json; charset=utf-8");
        headers.put("If-Match", "\"v1\"");
        server.enqueue(new MockResponse().setResponseCode(204).setHeader("ETag", "\"v2\""));
        WebdavClient.Result put = client.request(server.url("/dav/bilimusic/sync.json").toString(), "PUT", headers, content);
        assertEquals(204, put.status);
        assertEquals("\"v2\"", put.etag);
        RecordedRequest uploaded = server.takeRequest();
        assertEquals("PUT", uploaded.getMethod());
        assertEquals("\"v1\"", uploaded.getHeader("If-Match"));
        assertEquals(content, uploaded.getBody().readUtf8());
        server.enqueue(new MockResponse().setResponseCode(200).setHeader("ETag", "\"v2\"")
            .setHeader("Content-Type", "application/json; charset=utf-8").setBody(content));
        WebdavClient.Result get = client.request(server.url("/dav/bilimusic/sync.json").toString(), "GET", headers, null);
        assertEquals(content, get.content);
        assertEquals("\"v2\"", get.etag);
    }

    @Test public void authServerAndConflictStatusAreNotConvertedToSuccess() throws Exception {
        for (int status : new int[]{401, 403, 404, 412, 500}) {
            server.enqueue(new MockResponse().setResponseCode(status));
            assertEquals(status, client.request(server.url("/dav/file").toString(), "GET", headers, null).status);
        }
    }

    @Test public void redirectsToAnotherOriginDoNotLeakAuthorization() throws Exception {
        try (MockWebServer other = new MockWebServer()) {
            other.start();
            other.enqueue(new MockResponse().setBody("ok"));
            server.enqueue(new MockResponse().setResponseCode(302).setHeader("Location", other.url("/dav/").toString()));
            assertEquals(200, client.request(server.url("/dav/").toString(), "GET", headers, null).status);
            assertNull(other.takeRequest(2, TimeUnit.SECONDS).getHeader("Authorization"));
        }
    }
}
