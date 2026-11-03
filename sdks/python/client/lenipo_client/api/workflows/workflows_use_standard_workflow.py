from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from ...models.project_workflow import ProjectWorkflow
from typing import cast



def _get_kwargs(
    key: str,
    issue_type: str,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "delete",
        "url": "/api/v1/projects/{key}/workflow/types/{issue_type}".format(key=quote(str(key), safe=""),issue_type=quote(str(issue_type), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | ProjectWorkflow:
    if response.status_code == 200:
        response_200 = ProjectWorkflow.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem | ProjectWorkflow]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    key: str,
    issue_type: str,
    *,
    client: AuthenticatedClient | Client,

) -> Response[Problem | ProjectWorkflow]:
    """ Let an issue type use the standard workflow again

     Needs project administration. Issues of the type keep their status where the standard workflow has
    it, else take the first status of the same category or the initial status (history entry, no
    notifications).

    Args:
        key (str):
        issue_type (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | ProjectWorkflow]
     """


    kwargs = _get_kwargs(
        key=key,
issue_type=issue_type,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    key: str,
    issue_type: str,
    *,
    client: AuthenticatedClient | Client,

) -> Problem | ProjectWorkflow | None:
    """ Let an issue type use the standard workflow again

     Needs project administration. Issues of the type keep their status where the standard workflow has
    it, else take the first status of the same category or the initial status (history entry, no
    notifications).

    Args:
        key (str):
        issue_type (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | ProjectWorkflow
     """


    return sync_detailed(
        key=key,
issue_type=issue_type,
client=client,

    ).parsed

async def asyncio_detailed(
    key: str,
    issue_type: str,
    *,
    client: AuthenticatedClient | Client,

) -> Response[Problem | ProjectWorkflow]:
    """ Let an issue type use the standard workflow again

     Needs project administration. Issues of the type keep their status where the standard workflow has
    it, else take the first status of the same category or the initial status (history entry, no
    notifications).

    Args:
        key (str):
        issue_type (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | ProjectWorkflow]
     """


    kwargs = _get_kwargs(
        key=key,
issue_type=issue_type,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    key: str,
    issue_type: str,
    *,
    client: AuthenticatedClient | Client,

) -> Problem | ProjectWorkflow | None:
    """ Let an issue type use the standard workflow again

     Needs project administration. Issues of the type keep their status where the standard workflow has
    it, else take the first status of the same category or the initial status (history entry, no
    notifications).

    Args:
        key (str):
        issue_type (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | ProjectWorkflow
     """


    return (await asyncio_detailed(
        key=key,
issue_type=issue_type,
client=client,

    )).parsed
