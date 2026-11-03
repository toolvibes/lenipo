from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from ...models.project_agent_settings import ProjectAgentSettings
from ...models.update_project_agent_settings import UpdateProjectAgentSettings
from typing import cast



def _get_kwargs(
    key: str,
    *,
    body: UpdateProjectAgentSettings,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/api/v1/projects/{key}/agent-settings".format(key=quote(str(key), safe=""),),
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
    *,
    client: AuthenticatedClient | Client,
    body: UpdateProjectAgentSettings,

) -> Response[Problem | ProjectAgentSettings]:
    """ Change the agent settings of a project

     Approval for sprints, the statuses agents do not set themselves (a person approves the transition)
    and where reviews move the issue. Requires the project permission `administer`.

    Args:
        key (str):
        body (UpdateProjectAgentSettings):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | ProjectAgentSettings]
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
    body: UpdateProjectAgentSettings,

) -> Problem | ProjectAgentSettings | None:
    """ Change the agent settings of a project

     Approval for sprints, the statuses agents do not set themselves (a person approves the transition)
    and where reviews move the issue. Requires the project permission `administer`.

    Args:
        key (str):
        body (UpdateProjectAgentSettings):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | ProjectAgentSettings
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
    body: UpdateProjectAgentSettings,

) -> Response[Problem | ProjectAgentSettings]:
    """ Change the agent settings of a project

     Approval for sprints, the statuses agents do not set themselves (a person approves the transition)
    and where reviews move the issue. Requires the project permission `administer`.

    Args:
        key (str):
        body (UpdateProjectAgentSettings):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | ProjectAgentSettings]
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
    body: UpdateProjectAgentSettings,

) -> Problem | ProjectAgentSettings | None:
    """ Change the agent settings of a project

     Approval for sprints, the statuses agents do not set themselves (a person approves the transition)
    and where reviews move the issue. Requires the project permission `administer`.

    Args:
        key (str):
        body (UpdateProjectAgentSettings):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | ProjectAgentSettings
     """


    return (await asyncio_detailed(
        key=key,
client=client,
body=body,

    )).parsed
