from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.issue_export_request import IssueExportRequest
from ...models.problem import Problem
from ...types import File, FileTypes
from io import BytesIO
from typing import cast



def _get_kwargs(
    *,
    body: IssueExportRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/search/export",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> File | Problem:
    if response.status_code == 200:
        response_200 = File(
             payload = BytesIO(response.content)
        )



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[File | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: IssueExportRequest,

) -> Response[File | Problem]:
    """ Export search results

     Every issue of the TQL query (at most 10,000) as CSV (semicolons, UTF-8 with byte order mark), Excel
    or JSON. CSV and Excel have key, summary and the given columns; JSON has the full issue summaries.

    Args:
        body (IssueExportRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[File | Problem]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: IssueExportRequest,

) -> File | Problem | None:
    """ Export search results

     Every issue of the TQL query (at most 10,000) as CSV (semicolons, UTF-8 with byte order mark), Excel
    or JSON. CSV and Excel have key, summary and the given columns; JSON has the full issue summaries.

    Args:
        body (IssueExportRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        File | Problem
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: IssueExportRequest,

) -> Response[File | Problem]:
    """ Export search results

     Every issue of the TQL query (at most 10,000) as CSV (semicolons, UTF-8 with byte order mark), Excel
    or JSON. CSV and Excel have key, summary and the given columns; JSON has the full issue summaries.

    Args:
        body (IssueExportRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[File | Problem]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: IssueExportRequest,

) -> File | Problem | None:
    """ Export search results

     Every issue of the TQL query (at most 10,000) as CSV (semicolons, UTF-8 with byte order mark), Excel
    or JSON. CSV and Excel have key, summary and the given columns; JSON has the full issue summaries.

    Args:
        body (IssueExportRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        File | Problem
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
