from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.claim_next_request import ClaimNextRequest
from ...models.claim_result import ClaimResult
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    key: str,
    *,
    body: ClaimNextRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/projects/{key}/claim-next".format(key=quote(str(key), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ClaimResult | Problem:
    if response.status_code == 200:
        response_200 = ClaimResult.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ClaimResult | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: ClaimNextRequest,

) -> Response[ClaimResult | Problem]:
    """ Claim the next fitting issue of a project

     One’s own open claim first; otherwise unresolved issues of active and planned sprints, then of the
    whole project, in rank order, that are unassigned or one’s own, not claimed by others, not blocked
    by an unresolved issue and within the agent’s task filter and the optional `filter`. `claim` is null
    when nothing fits.

    Args:
        key (str):
        body (ClaimNextRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ClaimResult | Problem]
     """


    kwargs = _get_kwargs(
        key=key,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: ClaimNextRequest,

) -> ClaimResult | Problem | None:
    """ Claim the next fitting issue of a project

     One’s own open claim first; otherwise unresolved issues of active and planned sprints, then of the
    whole project, in rank order, that are unassigned or one’s own, not claimed by others, not blocked
    by an unresolved issue and within the agent’s task filter and the optional `filter`. `claim` is null
    when nothing fits.

    Args:
        key (str):
        body (ClaimNextRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ClaimResult | Problem
     """


    return sync_detailed(
        key=key,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: ClaimNextRequest,

) -> Response[ClaimResult | Problem]:
    """ Claim the next fitting issue of a project

     One’s own open claim first; otherwise unresolved issues of active and planned sprints, then of the
    whole project, in rank order, that are unassigned or one’s own, not claimed by others, not blocked
    by an unresolved issue and within the agent’s task filter and the optional `filter`. `claim` is null
    when nothing fits.

    Args:
        key (str):
        body (ClaimNextRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ClaimResult | Problem]
     """


    kwargs = _get_kwargs(
        key=key,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: ClaimNextRequest,

) -> ClaimResult | Problem | None:
    """ Claim the next fitting issue of a project

     One’s own open claim first; otherwise unresolved issues of active and planned sprints, then of the
    whole project, in rank order, that are unassigned or one’s own, not claimed by others, not blocked
    by an unresolved issue and within the agent’s task filter and the optional `filter`. `claim` is null
    when nothing fits.

    Args:
        key (str):
        body (ClaimNextRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ClaimResult | Problem
     """


    return (await asyncio_detailed(
        key=key,
client=client,
body=body,

    )).parsed
