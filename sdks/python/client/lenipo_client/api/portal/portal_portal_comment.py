from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.portal_comment_request import PortalCommentRequest
from ...models.portal_request_detail import PortalRequestDetail
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    issue_key: str,
    *,
    body: PortalCommentRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/portal/requests/{issue_key}/comments".format(issue_key=quote(str(issue_key), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> PortalRequestDetail | Problem:
    if response.status_code == 201:
        response_201 = PortalRequestDetail.from_dict(response.json())



        return response_201

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[PortalRequestDetail | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    issue_key: str,
    *,
    client: AuthenticatedClient | Client,
    body: PortalCommentRequest,

) -> Response[PortalRequestDetail | Problem]:
    """ Answer in a request

    Args:
        issue_key (str):
        body (PortalCommentRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PortalRequestDetail | Problem]
     """


    kwargs = _get_kwargs(
        issue_key=issue_key,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    issue_key: str,
    *,
    client: AuthenticatedClient | Client,
    body: PortalCommentRequest,

) -> PortalRequestDetail | Problem | None:
    """ Answer in a request

    Args:
        issue_key (str):
        body (PortalCommentRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PortalRequestDetail | Problem
     """


    return sync_detailed(
        issue_key=issue_key,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    issue_key: str,
    *,
    client: AuthenticatedClient | Client,
    body: PortalCommentRequest,

) -> Response[PortalRequestDetail | Problem]:
    """ Answer in a request

    Args:
        issue_key (str):
        body (PortalCommentRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PortalRequestDetail | Problem]
     """


    kwargs = _get_kwargs(
        issue_key=issue_key,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    issue_key: str,
    *,
    client: AuthenticatedClient | Client,
    body: PortalCommentRequest,

) -> PortalRequestDetail | Problem | None:
    """ Answer in a request

    Args:
        issue_key (str):
        body (PortalCommentRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PortalRequestDetail | Problem
     """


    return (await asyncio_detailed(
        issue_key=issue_key,
client=client,
body=body,

    )).parsed
