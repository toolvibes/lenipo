from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from ...models.projects_save_mail_handler_response_200 import ProjectsSaveMailHandlerResponse200
from ...models.save_mail_handler_request import SaveMailHandlerRequest
from typing import cast



def _get_kwargs(
    key: str,
    *,
    body: SaveMailHandlerRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/api/v1/projects/{key}/mail-handler".format(key=quote(str(key), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | ProjectsSaveMailHandlerResponse200:
    if response.status_code == 200:
        response_200 = ProjectsSaveMailHandlerResponse200.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem | ProjectsSaveMailHandlerResponse200]:
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
    body: SaveMailHandlerRequest,

) -> Response[Problem | ProjectsSaveMailHandlerResponse200]:
    """ Set up the mailbox of a project

    Args:
        key (str):
        body (SaveMailHandlerRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | ProjectsSaveMailHandlerResponse200]
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
    body: SaveMailHandlerRequest,

) -> Problem | ProjectsSaveMailHandlerResponse200 | None:
    """ Set up the mailbox of a project

    Args:
        key (str):
        body (SaveMailHandlerRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | ProjectsSaveMailHandlerResponse200
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
    body: SaveMailHandlerRequest,

) -> Response[Problem | ProjectsSaveMailHandlerResponse200]:
    """ Set up the mailbox of a project

    Args:
        key (str):
        body (SaveMailHandlerRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | ProjectsSaveMailHandlerResponse200]
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
    body: SaveMailHandlerRequest,

) -> Problem | ProjectsSaveMailHandlerResponse200 | None:
    """ Set up the mailbox of a project

    Args:
        key (str):
        body (SaveMailHandlerRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | ProjectsSaveMailHandlerResponse200
     """


    return (await asyncio_detailed(
        key=key,
client=client,
body=body,

    )).parsed
