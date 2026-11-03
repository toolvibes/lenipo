from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from ...models.project_agent_settings import ProjectAgentSettings
from ...models.set_agent_roles_request import SetAgentRolesRequest
from typing import cast



def _get_kwargs(
    key: str,
    user_id: str,
    *,
    body: SetAgentRolesRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/api/v1/projects/{key}/agent-settings/roles/{user_id}".format(key=quote(str(key), safe=""),user_id=quote(str(user_id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | ProjectAgentSettings:
    if response.status_code == 200:
        response_200 = ProjectAgentSettings.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem | ProjectAgentSettings]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    key: str,
    user_id: str,
    *,
    client: AuthenticatedClient | Client,
    body: SetAgentRolesRequest,

) -> Response[Problem | ProjectAgentSettings]:
    """ Set the roles of an agent in the project

     planner: plan, fill and start sprints; coordinator: complete them; implementer and tester: claim
    work; reviewer: review. No roles: implementer. Requires `administer`.

    Args:
        key (str):
        user_id (str):
        body (SetAgentRolesRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | ProjectAgentSettings]
     """


    kwargs = _get_kwargs(
        key=key,
user_id=user_id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    key: str,
    user_id: str,
    *,
    client: AuthenticatedClient | Client,
    body: SetAgentRolesRequest,

) -> Problem | ProjectAgentSettings | None:
    """ Set the roles of an agent in the project

     planner: plan, fill and start sprints; coordinator: complete them; implementer and tester: claim
    work; reviewer: review. No roles: implementer. Requires `administer`.

    Args:
        key (str):
        user_id (str):
        body (SetAgentRolesRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | ProjectAgentSettings
     """


    return sync_detailed(
        key=key,
user_id=user_id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    key: str,
    user_id: str,
    *,
    client: AuthenticatedClient | Client,
    body: SetAgentRolesRequest,

) -> Response[Problem | ProjectAgentSettings]:
    """ Set the roles of an agent in the project

     planner: plan, fill and start sprints; coordinator: complete them; implementer and tester: claim
    work; reviewer: review. No roles: implementer. Requires `administer`.

    Args:
        key (str):
        user_id (str):
        body (SetAgentRolesRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | ProjectAgentSettings]
     """


    kwargs = _get_kwargs(
        key=key,
user_id=user_id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    key: str,
    user_id: str,
    *,
    client: AuthenticatedClient | Client,
    body: SetAgentRolesRequest,

) -> Problem | ProjectAgentSettings | None:
    """ Set the roles of an agent in the project

     planner: plan, fill and start sprints; coordinator: complete them; implementer and tester: claim
    work; reviewer: review. No roles: implementer. Requires `administer`.

    Args:
        key (str):
        user_id (str):
        body (SetAgentRolesRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | ProjectAgentSettings
     """


    return (await asyncio_detailed(
        key=key,
user_id=user_id,
client=client,
body=body,

    )).parsed
